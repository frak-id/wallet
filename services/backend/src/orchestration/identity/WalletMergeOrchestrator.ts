import { log } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { currentChainId } from "@frak-labs/app-essentials/blockchain";
import type { Address, Hex } from "viem";
import type { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
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
        private readonly identityRepository: IdentityRepository,
        private readonly identityWeightService: IdentityWeightService,
        private readonly identityMergeService: IdentityMergeService,
        private readonly webAuthNValidatorReader: WebAuthNValidatorReader
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
            await this.authenticatorRepository.getActiveBinding({
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
     *
     * Each step is independently idempotent:
     *  1. {@link webAuthNValidatorReader.waitForReceipt} is a pure read.
     *  2. {@link webAuthNValidatorReader.getPasskey} is a pure read.
     *  3. {@link AuthenticatorRepository.repointBinding} is a no-op once the
     *     binding already points at `winner` (the partial unique on active
     *     bindings makes the second call a no-op via `ON CONFLICT DO NOTHING`).
     *  4. {@link IdentityMergeService.mergeGroupsByWallet} short-circuits
     *     when both wallets already resolve to the same group.
     *
     * A retried `settle()` therefore converges to the same final state, which
     * matches the failure-modes table in the Phase 1 design doc.
     */
    async settle(params: {
        requesterWallet: Address;
        requesterAuthenticatorId: string;
        targetAuthenticatorId: string;
        onChainTxHash: Hex;
    }): Promise<MergeSettleResponse> {
        const preview = await this.preview({
            requesterWallet: params.requesterWallet,
            requesterAuthenticatorId: params.requesterAuthenticatorId,
            targetAuthenticatorId: params.targetAuthenticatorId,
        });

        // 1. Confirm the addPassKey userOp landed on-chain.
        const receipt = await this.webAuthNValidatorReader.waitForReceipt({
            txHash: params.onChainTxHash,
        });
        if (receipt.status !== "success") {
            throw HttpError.unprocessable(
                "MERGE_USER_OP_REVERTED",
                `userOp ${params.onChainTxHash} reverted`
            );
        }

        // 2. Verify the on-chain validator now lists the loser passkey under
        //    the winner wallet. Guards against tx-hash forgery and against
        //    races where the userOp landed for a different credential.
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

        // 3. Repoint the loser's binding to the winner wallet. Email is
        //    stored as an identity node on the wallet's identity group, so it
        //    moves with the loser group during the PG merge (step 4). When
        //    both sides held a different email the anchor group ends up with
        //    multiple active email nodes; `findEmailForGroup` returns the
        //    oldest one deterministically (the surviving credential's email).
        await this.authenticatorRepository.repointBinding({
            credentialId: preview.loserAuthenticatorId,
            chainId: currentChainId,
            toSmartWalletAddress: preview.winner,
            reason: "merged",
        });

        // 4. Collapse the identity graphs. The weight cache has a 30s TTL,
        //    so we rely on that for staleness rather than chasing the new
        //    anchor group id back through the repository to issue a
        //    targeted `invalidateWeight(groupId)`.
        await this.identityMergeService.mergeGroupsByWallet({
            winnerWallet: preview.winner,
            loserWallet: preview.loser,
        });

        log.info(
            {
                chainId: currentChainId,
                winner: preview.winner,
                loser: preview.loser,
                credentialId: preview.loserAuthenticatorId,
                onChainTxHash: params.onChainTxHash,
            },
            "Wallet merge settled"
        );

        return {
            status: "merged",
            winner: preview.winner,
            loser: preview.loser,
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
