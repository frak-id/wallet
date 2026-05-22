import { db, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { buildMergeConsentChallengeSlots } from "@frak-labs/app-essentials";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import type { Address } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { WalletSessionService } from "../../domain/auth/services/WalletSessionService";
import type { WebAuthNService } from "../../domain/auth/services/WebAuthNService";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";
import type { WebAuthNValidatorReader } from "../../infrastructure/blockchain/WebAuthNValidatorReader";
import type { MergePreviewResponse, MergeSettleResponse } from "../schemas";
import type { IdentityMergeService } from "./IdentityMergeService";
import type { IdentityWeightService } from "./IdentityWeightService";

/**
 * Counts used by the UI to render the "you will gain N referrals" recap.
 * Mirrors the three weight dimensions of {@link IdentityWeightService}.
 */
export type MergeWeight = {
    assetsCount: number;
    referralsCount: number;
    interactionsCount: number;
};

export class WalletMergeOrchestrator {
    constructor(
        private readonly authenticatorRepository: AuthenticatorRepository,
        private readonly walletBindingRepository: WalletBindingRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly identityWeightService: IdentityWeightService,
        private readonly identityMergeService: IdentityMergeService,
        private readonly webAuthNValidatorReader: WebAuthNValidatorReader,
        private readonly webAuthNService: WebAuthNService,
        private readonly walletSessionService: WalletSessionService
    ) {}

    /**
     * Compute the merge preview. Always returns the same result for the
     * same inputs (deterministic): callers can call it from the UI for
     * the recap screen AND have settle() recompute it server-side without
     * the client persisting state in between.
     */
    async preview({
        requesterWallet,
        requesterAuthenticatorId,
        targetAuthenticatorId,
    }: {
        requesterWallet: Address;
        requesterAuthenticatorId: string;
        targetAuthenticatorId: string;
    }): Promise<MergePreviewResponse> {
        if (requesterAuthenticatorId === targetAuthenticatorId) {
            throw HttpError.badRequest(
                "MERGE_SAME_CREDENTIAL",
                "Requester and target credentials are the same"
            );
        }

        const targetBinding =
            await this.walletBindingRepository.getActiveBinding({
                credentialId: targetAuthenticatorId,
                chainId: currentChainId,
            });
        if (!targetBinding) {
            throw HttpError.notFound(
                "MERGE_TARGET_BINDING_NOT_FOUND",
                `No active binding for credential ${targetAuthenticatorId} on chain ${currentChainId}`
            );
        }

        const targetWallet = targetBinding.smartWalletAddress;
        if (targetWallet.toLowerCase() === requesterWallet.toLowerCase()) {
            throw HttpError.conflict(
                "MERGE_SAME_WALLET",
                "Requester and target resolve to the same wallet"
            );
        }

        const [requesterGroup, targetGroup] = await Promise.all([
            this.identityRepository.findGroupByIdentity({
                type: "wallet",
                value: requesterWallet,
            }),
            this.identityRepository.findGroupByIdentity({
                type: "wallet",
                value: targetWallet,
            }),
        ]);
        if (!requesterGroup) {
            throw HttpError.notFound(
                "MERGE_REQUESTER_GROUP_NOT_FOUND",
                `No identity group for requester wallet ${requesterWallet}`
            );
        }
        if (!targetGroup) {
            throw HttpError.notFound(
                "MERGE_TARGET_GROUP_NOT_FOUND",
                `No identity group for target wallet ${targetWallet}`
            );
        }

        const [requesterWeightRaw, targetWeightRaw] = await Promise.all([
            this.identityWeightService.getGroupWeight(requesterGroup.id),
            this.identityWeightService.getGroupWeight(targetGroup.id),
        ]);

        const requesterWeight: MergeWeight = {
            assetsCount: requesterWeightRaw.assetsCount,
            referralsCount: requesterWeightRaw.referralsCount,
            interactionsCount: requesterWeightRaw.interactionsCount,
        };
        const targetWeight: MergeWeight = {
            assetsCount: targetWeightRaw.assetsCount,
            referralsCount: targetWeightRaw.referralsCount,
            interactionsCount: targetWeightRaw.interactionsCount,
        };

        const requesterWins = pickWinner(
            { weight: requesterWeight, createdAt: requesterGroup.createdAt },
            { weight: targetWeight, createdAt: targetGroup.createdAt }
        );

        const winner = requesterWins ? requesterWallet : targetWallet;
        const loser = requesterWins ? targetWallet : requesterWallet;
        const loserAuthenticatorId = requesterWins
            ? targetAuthenticatorId
            : requesterAuthenticatorId;

        const loserCredential =
            await this.authenticatorRepository.getByCredentialId(
                loserAuthenticatorId
            );
        if (!loserCredential) {
            throw HttpError.notFound(
                "MERGE_LOSER_CREDENTIAL_NOT_FOUND",
                `No authenticator row for ${loserAuthenticatorId}`
            );
        }

        return {
            requesterWallet,
            targetWallet,
            winner,
            loser,
            loserAuthenticatorId,
            loserPublicKey: {
                x: loserCredential.publicKey.x,
                y: loserCredential.publicKey.y,
            },
            requesterWeight,
            targetWeight,
        };
    }

    /**
     * Finalise a merge after the user has signed the `addPassKey` userOp.
     * The frontend is responsible for waiting on the tx receipt (≥8
     * confirmations) before invoking this endpoint, so the backend only
     * needs to confirm the validator state reflects the merge (step 2).
     *
     * Steps 0-1 are pure reads. Step 2 wraps the binding repoint and the
     * identity-graph merge in a single postgres transaction — both commit
     * together or neither does. A retried `settle()` after a step 0-1
     * failure runs from scratch (everything before step 2 is read-only);
     * a retry after step 2 failed mid-transaction sees a fully rolled-back
     * state and re-runs cleanly. The dual-DB choreography that earlier
     * drafts spelled out is no longer necessary now that bindings live in
     * postgres alongside the identity graph.
     */
    async settle(params: {
        requesterWallet: Address;
        requesterAuthenticatorId: string;
        targetAuthenticatorId: string;
        loserConsentSignature: string;
    }): Promise<MergeSettleResponse> {
        const preview = await this.preview({
            requesterWallet: params.requesterWallet,
            requesterAuthenticatorId: params.requesterAuthenticatorId,
            targetAuthenticatorId: params.targetAuthenticatorId,
        });

        // 0. Verify the loser's webauthn consent. Done before any on-chain
        //    reads so unauthenticated attempts are rejected cheaply. The
        //    challenge is deterministic (`frak-merge-consent:{UTC hour}:
        //    {winner}:{loser authid}`); we accept the current hour and the
        //    two adjacent slots to absorb clock skew and flows that span an
        //    hour boundary. No DB storage — the dual-biometric AND-gate
        //    (loser consent + winner userOp verified at step 1) makes a replayable
        //    challenge format acceptable for the threat model.
        const consentChallenges = buildMergeConsentChallengeSlots({
            winner: preview.winner,
            loserAuthenticatorId: preview.loserAuthenticatorId,
        });
        const consentOk = await this.webAuthNService.verifyConsentSignature({
            compressedSignature: params.loserConsentSignature,
            expectedAuthenticatorId: preview.loserAuthenticatorId,
            expectedChallenges: consentChallenges,
        });
        if (!consentOk) {
            throw HttpError.unauthorized(
                "MERGE_INVALID_CONSENT",
                `Loser consent signature missing or invalid for ${preview.loserAuthenticatorId}`
            );
        }

        // 1. Verify the on-chain validator now lists the loser passkey under
        //    the winner wallet. The frontend has already waited on the tx
        //    receipt with 8 confirmations before invoking this endpoint, so
        //    a missing or mismatched pubkey here means either the userOp
        //    never landed for this credential or the client raced ahead.
        const onChainPubkey = await this.webAuthNValidatorReader.getPasskey({
            smartWallet: preview.winner,
            authenticatorId: preview.loserAuthenticatorId,
        });
        if (!onChainPubkey) {
            throw HttpError.unprocessable(
                "MERGE_ON_CHAIN_PASSKEY_MISSING",
                `Validator has no passkey for ${preview.loserAuthenticatorId} on ${preview.winner}`
            );
        }
        const expectedX = BigInt(preview.loserPublicKey.x);
        const expectedY = BigInt(preview.loserPublicKey.y);
        if (onChainPubkey.x !== expectedX || onChainPubkey.y !== expectedY) {
            throw HttpError.unprocessable(
                "MERGE_ON_CHAIN_PASSKEY_MISMATCH",
                `On-chain passkey for ${preview.loserAuthenticatorId} does not match the stored pubkey`
            );
        }

        // 2. Repoint the loser's binding AND collapse the identity graphs in
        //    a single postgres transaction. Email is stored as an identity
        //    node on the wallet's identity group, so it moves with the loser
        //    group during the merge. When both sides held a different email
        //    the anchor group ends up with multiple active email nodes;
        //    `findEmailForGroup` returns the oldest one deterministically
        //    (the surviving credential's email). The weight cache has a 30s
        //    TTL, so we rely on that for staleness rather than chasing the
        //    new anchor group id back through the repository to issue a
        //    targeted `invalidateWeight(groupId)`.
        await db.transaction(async (tx) => {
            await this.walletBindingRepository.repointBinding({
                credentialId: preview.loserAuthenticatorId,
                chainId: currentChainId,
                toSmartWalletAddress: preview.winner,
                reason: "merged",
                tx,
            });
            await this.identityMergeService.mergeGroupsByWallet({
                winnerWallet: preview.winner,
                loserWallet: preview.loser,
                tx,
            });
        });

        log.info(
            {
                chainId: currentChainId,
                winner: preview.winner,
                loser: preview.loser,
                credentialId: preview.loserAuthenticatorId,
            },
            "Wallet merge settled"
        );

        // 3. Mint a fresh wallet session for the requester when they
        //    authenticated with the loser credential. The credential's
        //    binding now points at the winner wallet (step 2), but the
        //    requester's existing JWT still references the stale loser
        //    address. Returning a freshly-minted session here lets the
        //    frontend `setSession` directly — no separate `/login`
        //    round-trip, no second biometric prompt. The consent assertion
        //    verified at step 0 is the security-equivalent proof of
        //    credential ownership.
        //
        //    Omitted when the requester is the winner (their existing JWT
        //    already resolves correctly via the unchanged binding for
        //    their credential).
        const requesterIsLoser =
            params.requesterAuthenticatorId === preview.loserAuthenticatorId;
        if (!requesterIsLoser) {
            return {
                status: "merged",
                winner: preview.winner,
                loser: preview.loser,
            };
        }

        const loserCredential =
            await this.authenticatorRepository.getByCredentialId(
                preview.loserAuthenticatorId
            );
        if (!loserCredential) {
            // Defensive — preview already loaded the same credential to
            // surface `loserPublicKey`. If it has vanished between then
            // and now, something has gone badly wrong, so fail loud rather
            // than ship a half-applied merge to the client.
            throw HttpError.notFound(
                "MERGE_LOSER_CREDENTIAL_NOT_FOUND",
                `No authenticator row for ${preview.loserAuthenticatorId}`
            );
        }
        const session = await this.walletSessionService.mintForCredential({
            authenticatorId: preview.loserAuthenticatorId,
            walletAddress: preview.winner,
            publicKey: loserCredential.publicKey,
            transports: loserCredential.transports,
        });

        return {
            status: "merged",
            winner: preview.winner,
            loser: preview.loser,
            session,
        };
    }
}

/**
 * Returns `true` when the requester side should win the merge.
 *
 * Total weight = assets + referrals + interactions. Tiebreaker is the older
 * `createdAt` (the wallet that has existed longer keeps its primacy);
 * deterministic fallback is "requester wins" so the result is stable even
 * for two groups created in the same millisecond.
 */
function pickWinner(
    requester: { weight: MergeWeight; createdAt: Date | null },
    target: { weight: MergeWeight; createdAt: Date | null }
): boolean {
    const requesterTotal = totalWeight(requester.weight);
    const targetTotal = totalWeight(target.weight);
    if (requesterTotal !== targetTotal) {
        return requesterTotal > targetTotal;
    }
    if (requester.createdAt && target.createdAt) {
        return requester.createdAt.getTime() <= target.createdAt.getTime();
    }
    return true;
}

function totalWeight(w: MergeWeight): number {
    return w.assetsCount + w.referralsCount + w.interactionsCount;
}
