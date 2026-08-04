import { db, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { buildMergeConsentChallengeSlots } from "@frak-labs/app-essentials";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import { type Address, isAddressEqual } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { WebAuthNService } from "../../domain/auth/services/WebAuthNService";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";
import type { WebAuthNValidatorReader } from "../../infrastructure/blockchain/WebAuthNValidatorReader";
import type { PairingRouterOrchestrator } from "../pairing/PairingRouterOrchestrator";
import type { MergePreviewResponse, MergeSettleResponse } from "../schemas";
import type { IdentityMergeService } from "./IdentityMergeService";
import {
    type IdentityWeightService,
    pickHeavierWeight,
} from "./IdentityWeightService";
import type { WalletSessionOrchestrator } from "./WalletSessionOrchestrator";

/**
 * Counts used by the UI to render the "you will gain N referrals" recap.
 * Mirrors the weight dimensions of {@link IdentityWeightService}; merchant
 * counts are surfaced so the recap can call out business-role transfers.
 */
export type MergeWeight = {
    assetsCount: number;
    referralsCount: number;
    interactionsCount: number;
    merchantOwnershipsCount: number;
    merchantAdminshipsCount: number;
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
        private readonly walletSessionOrchestrator: WalletSessionOrchestrator,
        // Used by the cross-device merge flow to push `merge-completed` to
        // both pairing topics after settlement. Same-device merges pass no
        // `pairingId` and the broadcast step is skipped.
        private readonly pairingRouterOrchestrator: PairingRouterOrchestrator
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
        if (isAddressEqual(targetWallet, requesterWallet)) {
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
            merchantOwnershipsCount: requesterWeightRaw.merchantOwnershipsCount,
            merchantAdminshipsCount: requesterWeightRaw.merchantAdminshipsCount,
        };
        const targetWeight: MergeWeight = {
            assetsCount: targetWeightRaw.assetsCount,
            referralsCount: targetWeightRaw.referralsCount,
            interactionsCount: targetWeightRaw.interactionsCount,
            merchantOwnershipsCount: targetWeightRaw.merchantOwnershipsCount,
            merchantAdminshipsCount: targetWeightRaw.merchantAdminshipsCount,
        };

        const requesterWins = pickWinner(
            { weight: requesterWeight },
            { weight: targetWeight }
        );

        const winner = requesterWins ? requesterWallet : targetWallet;
        const loser = requesterWins ? targetWallet : requesterWallet;
        const winnerAuthenticatorId = requesterWins
            ? requesterAuthenticatorId
            : targetAuthenticatorId;
        const loserAuthenticatorId = requesterWins
            ? targetAuthenticatorId
            : requesterAuthenticatorId;

        const [winnerCredential, loserCredential] = await Promise.all([
            this.authenticatorRepository.getByCredentialId(
                winnerAuthenticatorId
            ),
            this.authenticatorRepository.getByCredentialId(
                loserAuthenticatorId
            ),
        ]);
        if (!winnerCredential) {
            throw HttpError.notFound(
                "MERGE_WINNER_CREDENTIAL_NOT_FOUND",
                `No authenticator row for ${winnerAuthenticatorId}`
            );
        }
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
            winnerAuthenticatorId,
            winnerPublicKey: {
                x: winnerCredential.publicKey.x,
                y: winnerCredential.publicKey.y,
            },
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
     * The frontend waits on the tx receipt (≥8 confirmations) before
     * invoking this endpoint, so the backend only needs to confirm the
     * validator state reflects the merge.
     *
     * The binding repoint and identity-graph merge run inside a single
     * postgres transaction — both commit or neither does, so a retry after
     * a mid-transaction failure sees a fully rolled-back state and re-runs
     * cleanly.
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
        // Idempotent retry detection: a dropped response or any client-side
        // retry must converge on the same success rather than throw
        // MERGE_SAME_WALLET or churn the binding history. The active
        // bindings are themselves the proof the merge happened, so consent
        // re-verification is redundant on the retry path.
        const settled = await this.detectSettledMerge({
            requesterWallet: params.requesterWallet,
            requesterAuthenticatorId: params.requesterAuthenticatorId,
            targetAuthenticatorId: params.targetAuthenticatorId,
            pairingId: params.pairingId,
        });
        if (settled) return settled;

        const preview = await this.preview({
            requesterWallet: params.requesterWallet,
            requesterAuthenticatorId: params.requesterAuthenticatorId,
            targetAuthenticatorId: params.targetAuthenticatorId,
        });

        // Verify the loser's webauthn consent before any on-chain reads, so
        // unauthenticated attempts are rejected cheaply. The challenge is
        // deterministic (`frak-merge-consent:{UTC hour}:{winner}:{loser
        // authid}`); the current hour ± one slot absorbs clock skew. No DB
        // storage needed — the dual-biometric AND-gate (loser consent +
        // winner userOp) makes a replayable challenge acceptable here.
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

        // Verify the on-chain validator now lists the loser passkey under
        // the winner wallet. A missing/mismatched pubkey means the userOp
        // never landed for this credential, or the client raced ahead.
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

        // Repoint the loser's binding and collapse the identity graphs in a
        // single transaction. Email is an identity node on the wallet's
        // group, so it moves with the loser group; `mergeGroups` reconciles
        // differing emails to a single active one on the anchor.
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
        // Evict caches after the transaction commits — doing it inside
        // would let concurrent readers repopulate from pre-commit state.
        // `invalidateCachesForGroup` drops the `(groupId → wallet)` mapping
        // for every absorbed group so stale readers resolve to null.
        for (const absorbedGroupId of [
            ...mergeResult.mergedGroupIds,
            ...mergeResult.previouslyMergedGroupIds,
        ]) {
            this.identityRepository.invalidateCachesForGroup(absorbedGroupId);
            this.identityWeightService.invalidateWeight(absorbedGroupId);
        }
        // The anchor group's weight changed (absorbed assets, referrals,
        // interactions). Without invalidation, the 30s TTL would serve
        // stale counts to a preview racing a follow-up merge.
        const winnerGroup = await this.identityRepository.findGroupByIdentity({
            type: "wallet",
            value: preview.winner,
        });
        if (winnerGroup) {
            this.identityWeightService.invalidateWeight(winnerGroup.id);
        }
        // `mergeGroups` skips its auto-clear when an outer `tx` is supplied,
        // so the referral chain cache is cleared here instead, post-commit.
        this.identityMergeService.clearReferralChainCache();
        // Merchant caches need the same post-commit eviction — the merge
        // rewrote `owner_wallet`/`merchant_admins`, and the repository's
        // LRUs would otherwise serve the pre-merge row for up to 60 min.
        this.identityMergeService.invalidateMerchantCaches(
            mergeResult.affectedMerchantIds
        );

        log.info(
            {
                chainId: currentChainId,
                winner: preview.winner,
                loser: preview.loser,
                credentialId: preview.loserAuthenticatorId,
            },
            "Wallet merge settled"
        );

        // Mint a fresh wallet session for the loser credential: its binding
        // now points at the winner wallet, but any JWT issued before
        // settlement still references the stale loser address.
        //
        // Same-device: returned in the HTTP response only when the requester
        // is the loser. Cross-device: minted whenever a pairing carried the
        // flow and pushed via `merge-completed`; the HTTP response still
        // only carries it when the requester is the loser.
        const requesterIsLoser =
            params.requesterAuthenticatorId === preview.loserAuthenticatorId;
        const needsLoserSession = requesterIsLoser || !!params.pairingId;
        const loserSession = needsLoserSession
            ? await this.walletSessionOrchestrator.mintSessionForExplicitWallet(
                  {
                      credentialId: preview.loserAuthenticatorId,
                      walletAddress: preview.winner,
                  }
              )
            : undefined;

        if (params.pairingId && loserSession) {
            await this.pairingRouterOrchestrator.broadcastMergeCompleted({
                pairingId: params.pairingId,
                winner: preview.winner,
                loser: preview.loser,
                loserAuthenticatorId: preview.loserAuthenticatorId,
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
     * Detect that the requested merge has already settled — both
     * credentials' active bindings on the current chain now resolve to the
     * same wallet. Used to make `settle()` idempotent: a retried call after
     * a successful merge (lost HTTP response, post-commit publish failure)
     * converges on the original success rather than failing in `preview()`
     * with `MERGE_SAME_WALLET` or churning the binding history.
     *
     * Returns `null` when the merge has NOT yet settled (normal first-call
     * path) or when the binding state is ambiguous (no unlinked history on
     * either credential). The ambiguous case falls through to the normal
     * flow which will surface the inconsistency with a clear error.
     */
    private async detectSettledMerge(params: {
        requesterWallet: Address;
        requesterAuthenticatorId: string;
        targetAuthenticatorId: string;
        pairingId?: string;
    }): Promise<MergeSettleResponse | null> {
        if (params.requesterAuthenticatorId === params.targetAuthenticatorId) {
            return null;
        }

        const [requesterActive, targetActive] = await Promise.all([
            this.walletBindingRepository.getActiveBinding({
                credentialId: params.requesterAuthenticatorId,
                chainId: currentChainId,
            }),
            this.walletBindingRepository.getActiveBinding({
                credentialId: params.targetAuthenticatorId,
                chainId: currentChainId,
            }),
        ]);
        if (!requesterActive || !targetActive) return null;
        if (
            !isAddressEqual(
                requesterActive.smartWalletAddress,
                targetActive.smartWalletAddress
            )
        ) {
            return null;
        }

        // Both bindings point to the same wallet — already settled.
        // Reconstruct the loser to mint the right session and report it.
        const winner = requesterActive.smartWalletAddress;
        const requesterIsLoser = !isAddressEqual(
            params.requesterWallet,
            winner
        );
        const resolved = await this.resolveSettledLoser({
            requesterIsLoser,
            requesterWallet: params.requesterWallet,
            requesterAuthenticatorId: params.requesterAuthenticatorId,
            targetAuthenticatorId: params.targetAuthenticatorId,
        });
        if (!resolved) return null;
        const { loser, loserAuthenticatorId } = resolved;

        // Mint the loser-side session when the requester is the loser (JWT
        // references the stale pre-merge address) or a pairing carried the
        // flow (peer device needs the fresh JWT pushed).
        const needsLoserSession = requesterIsLoser || !!params.pairingId;
        const loserSession = needsLoserSession
            ? await this.walletSessionOrchestrator.mintSessionForExplicitWallet(
                  {
                      credentialId: loserAuthenticatorId,
                      walletAddress: winner,
                  }
              )
            : undefined;

        // Re-broadcast on retry so a loser device that missed the original
        // event still gets its fresh session; idempotent on the loser side.
        if (params.pairingId && loserSession) {
            await this.pairingRouterOrchestrator.broadcastMergeCompleted({
                pairingId: params.pairingId,
                winner,
                loser,
                loserAuthenticatorId,
                loserSession,
            });
        }

        log.info(
            {
                chainId: currentChainId,
                winner,
                loser,
                credentialId: loserAuthenticatorId,
                requesterIsLoser,
            },
            "Wallet merge settle: idempotent retry detected, returning settled response"
        );

        return {
            status: "merged",
            winner,
            loser,
            session: requesterIsLoser ? loserSession : undefined,
        };
    }

    /**
     * Reconstruct the pre-merge loser identity from the unlinked binding
     * history, used by `detectSettledMerge` to populate the idempotent
     * response.
     *
     * When the requester is the loser, their JWT's claimed wallet is
     * cross-checked against the loser credential's own unlinked binding row.
     * Without this, a captured pre-merge JWT could be replayed against a
     * post-merge `/settle` to upgrade a stolen token into a long-lived
     * winner-bound session without ever presenting the passkey.
     *
     * Returns `null` when the state is ambiguous; callers fall through to
     * the normal flow, which surfaces the inconsistency with a clearer error.
     */
    private async resolveSettledLoser(params: {
        requesterIsLoser: boolean;
        requesterWallet: Address;
        requesterAuthenticatorId: string;
        targetAuthenticatorId: string;
    }): Promise<{ loser: Address; loserAuthenticatorId: string } | null> {
        const credentialId = params.requesterIsLoser
            ? params.requesterAuthenticatorId
            : params.targetAuthenticatorId;
        const unlinked =
            await this.walletBindingRepository.getLastUnlinkedBinding({
                credentialId,
                chainId: currentChainId,
            });
        if (unlinked?.reason !== "merged") return null;
        if (
            params.requesterIsLoser &&
            !isAddressEqual(unlinked.smartWalletAddress, params.requesterWallet)
        ) {
            return null;
        }
        return {
            loser: params.requesterIsLoser
                ? params.requesterWallet
                : unlinked.smartWalletAddress,
            loserAuthenticatorId: credentialId,
        };
    }
}

/**
 * Returns `true` when the requester side should win the merge.
 *
 * Delegates to {@link pickHeavierWeight} — the same tie-break rule
 * `IdentityWeightService` uses for anonymous-id/wallet merges (weighted
 * total, merchant roles 10x, then a per-dimension priority order) — so a
 * tie resolves identically regardless of which merge path decided it.
 * `weight1` (the requester) wins any full tie, matching the previous
 * deterministic fallback.
 */
export function pickWinner(
    requester: { weight: MergeWeight },
    target: { weight: MergeWeight }
): boolean {
    return (
        pickHeavierWeight(requester.weight, target.weight) === requester.weight
    );
}
