import { db, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { buildMergeConsentChallengeSlots } from "@frak-labs/app-essentials";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import { eq } from "drizzle-orm";
import { type Address, isAddressEqual } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type {
    MintForCredentialResult,
    WalletSessionService,
} from "../../domain/auth/services/WalletSessionService";
import type { WebAuthNService } from "../../domain/auth/services/WebAuthNService";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";
import { pairingTable } from "../../domain/pairing/db/schema";
import type { PairingRouterRepository } from "../../domain/pairing/repositories/PairingRouterRepository";
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
        private readonly walletSessionService: WalletSessionService,
        // Used by Phase 2 (cross-device merge) to push `merge-completed`
        // to both pairing topics after settlement. Same-device merges
        // pass no `pairingId` and the publish step is skipped.
        private readonly pairingRouterRepository: PairingRouterRepository
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
        /**
         * Set by the cross-device flow. When present, after a successful
         * settlement the orchestrator pushes `merge-completed` on both
         * pairing topics — the loser side gets a freshly-minted webauthn
         * session so it can replace the stale one without a re-login.
         */
        pairingId?: string;
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
        const mergeResult = await db.transaction(async (tx) => {
            await this.walletBindingRepository.repointBinding({
                credentialId: preview.loserAuthenticatorId,
                chainId: currentChainId,
                toSmartWalletAddress: preview.winner,
                reason: "merged",
                tx,
            });
            return this.identityMergeService.mergeGroupsByWallet({
                winnerWallet: preview.winner,
                loserWallet: preview.loser,
                tx,
            });
        });

        // Evict cached `groupId → wallet` entries for every absorbed group
        // (the loser plus any group it had previously absorbed). Without
        // this, a caller holding a stale `loserGroupId` reference would
        // resolve to the loser wallet for up to the cache TTL (60s) even
        // though the group is now deleted and its identity nodes have been
        // re-anchored to the winner. The merge tx itself doesn't go through
        // the repository, so the cache never observed the deletion.
        for (const absorbedGroupId of [
            ...mergeResult.mergedGroupIds,
            ...mergeResult.previouslyMergedGroupIds,
        ]) {
            this.identityRepository.invalidateCachesForGroup(absorbedGroupId);
        }

        log.info(
            {
                chainId: currentChainId,
                winner: preview.winner,
                loser: preview.loser,
                credentialId: preview.loserAuthenticatorId,
            },
            "Wallet merge settled"
        );

        // 3. Mint a fresh wallet session for the loser credential.
        //    The credential's binding now points at the winner wallet
        //    (step 2), but any JWT issued before settlement still
        //    references the stale loser address — both the requester
        //    (same-device, when they authenticated with the loser
        //    credential) and the paired peer (cross-device, when the
        //    peer device holds the loser credential) need a fresh JWT.
        //
        //    Same-device contract: returned in the HTTP response only
        //    when the requester is the loser (their existing JWT no
        //    longer resolves correctly).
        //
        //    Cross-device contract: minted whenever a pairing carried
        //    the flow, so the orchestrator can push it on the loser's
        //    pairing topic via `merge-completed`. The HTTP response
        //    still only carries it when the requester is the loser, to
        //    keep the same-device contract unchanged.
        const requesterIsLoser =
            params.requesterAuthenticatorId === preview.loserAuthenticatorId;
        const needsLoserSession = requesterIsLoser || !!params.pairingId;
        const loserSession = needsLoserSession
            ? await this.mintLoserSession(preview)
            : undefined;

        if (params.pairingId && loserSession) {
            await this.publishMergeCompleted({
                pairingId: params.pairingId,
                preview,
                loserSession,
            });
        }

        return {
            status: "merged",
            winner: preview.winner,
            loser: preview.loser,
            session: requesterIsLoser ? loserSession : undefined,
        };
    }

    /**
     * Mints a fresh webauthn session keyed to the loser credential, now
     * bound to the winner wallet. Centralised so both the same-device
     * (HTTP response) and cross-device (`merge-completed` topic) paths
     * stay in lockstep with the consent-driven minting contract.
     */
    private async mintLoserSession(
        preview: MergePreviewResponse
    ): Promise<MintForCredentialResult> {
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
        return this.walletSessionService.mintForCredential({
            authenticatorId: preview.loserAuthenticatorId,
            walletAddress: preview.winner,
            publicKey: loserCredential.publicKey,
            transports: loserCredential.transports,
        });
    }

    /**
     * Resolves which side of the pairing holds the loser wallet, then
     * pushes `merge-completed` on both topics via the router repo.
     *
     * The pairing row's `wallet` column was set at join-time to the
     * target's smart-account address — so it's the source of truth for
     * who's on the target side. The loser side is determined by
     * comparing it to `preview.loser`. If the loser address doesn't
     * match either side we log a warning and skip publishing rather
     * than guess — the on-chain + DB merge already committed, so the
     * worst case is the loser device needs a manual reload to pick up
     * its new session.
     */
    private async publishMergeCompleted({
        pairingId,
        preview,
        loserSession,
    }: {
        pairingId: string;
        preview: MergePreviewResponse;
        loserSession: MintForCredentialResult;
    }): Promise<void> {
        const pairing = await db.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, pairingId),
        });
        if (!pairing) {
            log.warn(
                { pairingId, winner: preview.winner, loser: preview.loser },
                "[WalletMerge] cannot publish merge-completed: pairing not found"
            );
            return;
        }

        // Pairing row's `wallet` is the target wallet (set at join).
        // The merge moves the loser credential under the winner wallet,
        // but the pairing row's `wallet` references the address the
        // target authenticated with at join-time, which may pre-date
        // the rebind. That's still correct here because we run this
        // before any other settle on this row, so `pairing.wallet`
        // still reflects the join-time identity.
        const targetWallet = pairing.wallet;
        if (!targetWallet) {
            log.warn(
                { pairingId },
                "[WalletMerge] cannot publish merge-completed: pairing unresolved"
            );
            return;
        }

        let loserSide: "origin" | "target";
        if (isAddressEqual(targetWallet, preview.loser)) {
            loserSide = "target";
        } else if (isAddressEqual(targetWallet, preview.winner)) {
            loserSide = "origin";
        } else {
            log.warn(
                {
                    pairingId,
                    targetWallet,
                    winner: preview.winner,
                    loser: preview.loser,
                },
                "[WalletMerge] pairing wallet matches neither winner nor loser; skipping merge-completed"
            );
            return;
        }

        this.pairingRouterRepository.publishMergeCompleted({
            pairingId,
            loserSide,
            payload: {
                pairingId,
                winner: preview.winner,
                loser: preview.loser,
                loserAuthenticatorId: preview.loserAuthenticatorId,
                session: {
                    token: loserSession.token,
                    sdkJwt: loserSession.sdkJwt,
                    wallet: {
                        type: "webauthn",
                        address: loserSession.address,
                        authenticatorId: loserSession.authenticatorId,
                        publicKey: loserSession.publicKey,
                        transports: loserSession.transports,
                    },
                },
            },
        });
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
