import { db, log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { buildMergeConsentChallengeSlots } from "@frak-labs/app-essentials";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import { eq } from "drizzle-orm";
import { type Address, isAddressEqual } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { MintForCredentialResult } from "../../domain/auth/services/WalletJwtService";
import type { WebAuthNService } from "../../domain/auth/services/WebAuthNService";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { WalletBindingRepository } from "../../domain/identity/repositories/WalletBindingRepository";
import { pairingTable } from "../../domain/pairing/db/schema";
import type { PairingRouterRepository } from "../../domain/pairing/repositories/PairingRouterRepository";
import type { WebAuthNValidatorReader } from "../../infrastructure/blockchain/WebAuthNValidatorReader";
import type { MergePreviewResponse, MergeSettleResponse } from "../schemas";
import type { IdentityMergeService } from "./IdentityMergeService";
import type { IdentityWeightService } from "./IdentityWeightService";
import type { WalletSessionOrchestrator } from "./WalletSessionOrchestrator";

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
        private readonly walletSessionOrchestrator: WalletSessionOrchestrator,
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
        // 0. Idempotent retry detection. A dropped HTTP response, a
        //    post-commit publish failure, or any other client-side retry
        //    must converge on the same success response rather than throw
        //    `MERGE_SAME_WALLET` from `preview()` (both bindings now resolve
        //    to the winner) or churn the binding history with redundant
        //    repoints. The active bindings themselves are the cryptographic
        //    proof the merge happened, so consent re-verification is
        //    redundant on the retry path — the requester's JWT still proves
        //    they own the credential, and the credential's binding is the
        //    canonical record of the new wallet ownership.
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

        // 1. Verify the loser's webauthn consent. Done before any on-chain
        //    reads so unauthenticated attempts are rejected cheaply. The
        //    challenge is deterministic (`frak-merge-consent:{UTC hour}:
        //    {winner}:{loser authid}`); we accept the current hour and the
        //    two adjacent slots to absorb clock skew and flows that span an
        //    hour boundary. No DB storage — the dual-biometric AND-gate
        //    (loser consent + winner userOp verified at step 2) makes a replayable
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

        // 2. Verify the on-chain validator now lists the loser passkey under
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

        // 3. Repoint the loser's binding AND collapse the identity graphs in
        //    a single postgres transaction. Email is stored as an identity
        //    node on the wallet's identity group, so it moves with the loser
        //    group during the merge. When both sides held a different email
        //    the anchor group ends up with multiple active email nodes;
        //    `findEmailForGroup` returns the oldest one deterministically
        //    (the surviving credential's email).
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
        // Evict caches AFTER the transaction commits. Doing this inside the
        // transaction would let concurrent readers repopulate from
        // pre-commit state.
        //
        // `invalidateCachesForGroup` drops the `(groupId → wallet)` mapping
        // for every absorbed group so callers holding a stale loserGroupId
        // resolve to null instead of the now-soft-unlinked loser wallet.
        for (const absorbedGroupId of [
            ...mergeResult.mergedGroupIds,
            ...mergeResult.previouslyMergedGroupIds,
        ]) {
            this.identityRepository.invalidateCachesForGroup(absorbedGroupId);
            this.identityWeightService.invalidateWeight(absorbedGroupId);
        }
        // The anchor group's weight changed (it just absorbed assets,
        // referrals, and interactions from the loser side). Without an
        // explicit invalidation, the 30s TTL would serve stale counts to
        // any preview that races against a follow-up merge.
        const winnerGroup = await this.identityRepository.findGroupByIdentity({
            type: "wallet",
            value: preview.winner,
        });
        if (winnerGroup) {
            this.identityWeightService.invalidateWeight(winnerGroup.id);
        }
        // Chain cache lives on `referralLinkRepository`; `mergeGroups` skips
        // the auto-clear when an outer `tx` is supplied so we clear it here
        // (the outer transaction is now committed).
        this.identityMergeService.clearReferralChainCache();

        log.info(
            {
                chainId: currentChainId,
                winner: preview.winner,
                loser: preview.loser,
                credentialId: preview.loserAuthenticatorId,
            },
            "Wallet merge settled"
        );

        // 4. Mint a fresh wallet session for the loser credential.
        //    The credential's binding now points at the winner wallet
        //    (step 3), but any JWT issued before settlement still
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
            ? await this.walletSessionOrchestrator.mintSessionForExplicitWallet(
                  {
                      credentialId: preview.loserAuthenticatorId,
                      walletAddress: preview.winner,
                  }
              )
            : undefined;

        if (params.pairingId && loserSession) {
            await this.publishMergeCompleted({
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

        // Both bindings point to the same wallet — the merge has already
        // settled. Reconstruct who the loser was so we can mint the right
        // session and report a meaningful `loser` field.
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

        // Mint the loser-side session when the requester is the loser (their
        // JWT references the stale pre-merge address) or when a pairing
        // carried the flow (peer device needs the fresh JWT pushed over the
        // merge-completed topic).
        const needsLoserSession = requesterIsLoser || !!params.pairingId;
        const loserSession = needsLoserSession
            ? await this.walletSessionOrchestrator.mintSessionForExplicitWallet(
                  {
                      credentialId: loserAuthenticatorId,
                      walletAddress: winner,
                  }
              )
            : undefined;

        // Re-publish merge-completed on retry so a loser device that
        // missed the original event still picks up its fresh session.
        // Cheap and idempotent on the loser side (applySession overrides
        // any stale session).
        if (params.pairingId && loserSession) {
            await this.publishMergeCompleted({
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
     * When the requester is the loser (their JWT carries the pre-merge
     * loser address), we cross-check the JWT's claimed wallet against the
     * loser credential's own unlinked binding row. Without this check a
     * captured pre-merge JWT could be replayed against any post-merge
     * `/settle` to upgrade a stolen short-lived token into a long-lived
     * winner-bound session without ever presenting the passkey.
     *
     * Returns `null` when the state is ambiguous (no merged unlinked row
     * on either side, or a mismatch between the requester's claim and the
     * binding history); callers should fall through to the normal flow,
     * which will surface the inconsistency with a clearer error.
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
        if (!unlinked || unlinked.reason !== "merged") return null;
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

    /**
     * Resolves which side of the pairing holds the loser wallet, then
     * pushes `merge-completed` on both topics via the router repo.
     *
     * The pairing row's `wallet` column was set at join-time to the
     * target's smart-account address — so it's the source of truth for
     * who's on the target side. The loser side is determined by
     * comparing it to the loser address. If the loser address doesn't
     * match either side we log a warning and skip publishing rather
     * than guess — the on-chain + DB merge already committed, so the
     * worst case is the loser device needs a manual reload to pick up
     * its new session.
     */
    private async publishMergeCompleted({
        pairingId,
        winner,
        loser,
        loserAuthenticatorId,
        loserSession,
    }: {
        pairingId: string;
        winner: Address;
        loser: Address;
        loserAuthenticatorId: string;
        loserSession: MintForCredentialResult;
    }): Promise<void> {
        const pairing = await db.query.pairingTable.findFirst({
            where: eq(pairingTable.pairingId, pairingId),
        });
        if (!pairing) {
            log.warn(
                { pairingId, winner, loser },
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
        if (isAddressEqual(targetWallet, loser)) {
            loserSide = "target";
        } else if (isAddressEqual(targetWallet, winner)) {
            loserSide = "origin";
        } else {
            log.warn(
                {
                    pairingId,
                    targetWallet,
                    winner,
                    loser,
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
                winner,
                loser,
                loserAuthenticatorId,
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
