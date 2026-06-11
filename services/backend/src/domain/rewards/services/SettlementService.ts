import type { TokenMetadataRepository } from "@backend-infrastructure";
import { log } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import type {
    PushRewardParams,
    RewardsHubRepository,
    SettlementTxResult,
} from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { RewardConfig } from "../config";
import type { AssetLogSelect } from "../db/schema";
import type { AssetLogRepository } from "../repositories/AssetLogRepository";
import {
    buildAttestation,
    type InteractionType,
    type SettlementResult,
} from "../types";

export type AssetLogWithWallet = AssetLogSelect & {
    walletAddress: Address;
    interactionType: InteractionType | null;
};

type PreparedSettlement = {
    rewards: PushRewardParams[];
    validAssetLogIds: string[];
    errors: { assetLogId: string; error: string }[];
};

export class SettlementService {
    constructor(
        private readonly assetLogRepository: AssetLogRepository,
        private readonly rewardsHub: RewardsHubRepository,
        private readonly tokenMetadata: TokenMetadataRepository
    ) {}

    async settleRewards(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>
    ): Promise<SettlementResult> {
        const result: SettlementResult = {
            settledCount: 0,
            failedCount: 0,
            txHashes: [],
            errors: [],
            banks: new Set(),
            settledAssetLogIds: [],
        };

        if (rewards.length === 0) {
            log.debug("No rewards to settle");
            return result;
        }

        const prepared = await this.prepareRewards(rewards, merchantBanks);

        result.failedCount = prepared.errors.length;
        result.errors = prepared.errors;

        if (prepared.rewards.length === 0) {
            return result;
        }

        const rewardsByBank = new Map<
            Address,
            { rewards: PushRewardParams[]; assetLogIds: string[] }
        >();

        prepared.rewards.forEach((reward, index) => {
            const existing = rewardsByBank.get(reward.bank);
            if (!existing) {
                rewardsByBank.set(reward.bank, {
                    rewards: [reward],
                    assetLogIds: [prepared.validAssetLogIds[index]],
                });
                return;
            }

            existing.rewards.push(reward);
            existing.assetLogIds.push(prepared.validAssetLogIds[index]);
        });

        for (const [bank, bankBatch] of rewardsByBank.entries()) {
            await this.settleBankBatch(bank, bankBatch, result);
        }

        log.info(
            {
                settled: result.settledCount,
                failed: result.failedCount,
                txCount: result.txHashes.length,
            },
            "Settlement batch completed"
        );

        return result;
    }

    private async settleBankBatch(
        bank: Address,
        bankBatch: { rewards: PushRewardParams[]; assetLogIds: string[] },
        result: SettlementResult
    ): Promise<void> {
        await this.assetLogRepository.markSettlementProcessing(
            bankBatch.assetLogIds
        );

        let txResult: SettlementTxResult;
        try {
            txResult = await this.rewardsHub.pushRewards(bankBatch.rewards, {
                confirmations: RewardConfig.settlement.confirmations,
                onBroadcast: async (txHash) => {
                    await this.assetLogRepository.recordSettlementBroadcast(
                        bankBatch.assetLogIds,
                        txHash
                    );
                },
            });
        } catch (error) {
            // Broadcast itself threw — nothing reached the chain, safe to revert
            // and retry. (A post-broadcast failure returns `timeout` instead,
            // never throws, so it can't land here.)
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            log.error(
                { error, bank, count: bankBatch.rewards.length },
                "Settlement broadcast failed for bank, reverting to pending"
            );
            await this.assetLogRepository.revertSettlementToPending(
                bankBatch.assetLogIds,
                errorMessage
            );
            this.recordBatchFailure(
                result,
                bankBatch.assetLogIds,
                errorMessage
            );
            return;
        }

        if (txResult.status === "confirmed") {
            await this.assetLogRepository.updateStatusBatch(
                bankBatch.assetLogIds,
                "settled",
                { txHash: txResult.txHash, blockNumber: txResult.blockNumber }
            );
            // Report ids as settled only after the status write commits, so
            // callers never notify on a reward whose persistence failed.
            result.txHashes.push(txResult.txHash);
            result.banks.add(bank);
            result.settledCount += bankBatch.rewards.length;
            result.settledAssetLogIds.push(...bankBatch.assetLogIds);
            return;
        }

        if (txResult.status === "reverted") {
            await this.assetLogRepository.revertSettlementToPending(
                bankBatch.assetLogIds,
                "Settlement transaction reverted on-chain"
            );
            this.recordBatchFailure(
                result,
                bankBatch.assetLogIds,
                "Settlement transaction reverted on-chain"
            );
            return;
        }

        // status === "timeout": the tx was broadcast but its receipt is unknown.
        // Leave the rows `processing` with their persisted hash for
        // reconcileStuckSettlements — reverting risks re-sending a live tx.
        result.txHashes.push(txResult.txHash);
        result.banks.add(bank);
        log.warn(
            { bank, txHash: txResult.txHash, count: bankBatch.rewards.length },
            "Settlement receipt pending; left for reconciliation"
        );
    }

    private recordBatchFailure(
        result: SettlementResult,
        assetLogIds: string[],
        error: string
    ): void {
        for (const assetLogId of assetLogIds) {
            result.errors.push({ assetLogId, error });
        }
        result.failedCount += assetLogIds.length;
    }

    /**
     * Resolve rows stuck `processing` past the threshold (crash mid-settlement,
     * or a broadcast whose receipt never resolved) by reading their on-chain
     * fate, instead of blindly re-pending them and risking a double-pay:
     *  - confirmed success → `settled`;
     *  - reverted, or a fully-dropped tx → back to `pending` (no funds moved);
     *  - still mineable (tx known to a node) → left untouched for a later run;
     *  - never broadcast (no hash) → back to `pending`.
     * Rows sharing one batch tx hash are resolved together.
     */
    async reconcileStuckSettlements(olderThanMinutes: number): Promise<{
        settled: number;
        reverted: number;
        pending: number;
    }> {
        const stuck =
            await this.assetLogRepository.findStuckProcessing(olderThanMinutes);
        if (stuck.length === 0) {
            return { settled: 0, reverted: 0, pending: 0 };
        }

        const withoutHash = stuck
            .filter((row) => !row.onchainTxHash)
            .map((row) => row.id);
        if (withoutHash.length > 0) {
            await this.assetLogRepository.revertSettlementToPending(
                withoutHash,
                "Stuck in processing without a broadcast tx"
            );
        }

        const idsByHash = new Map<Hex, string[]>();
        for (const row of stuck) {
            if (!row.onchainTxHash) continue;
            const ids = idsByHash.get(row.onchainTxHash) ?? [];
            ids.push(row.id);
            idsByHash.set(row.onchainTxHash, ids);
        }

        let settled = 0;
        let reverted = withoutHash.length;
        let pending = 0;

        for (const [txHash, ids] of idsByHash) {
            const receipt = await this.rewardsHub.getReceipt(txHash);

            if (receipt?.status === "success") {
                await this.assetLogRepository.updateStatusBatch(
                    ids,
                    "settled",
                    {
                        txHash,
                        blockNumber: receipt.blockNumber,
                    }
                );
                settled += ids.length;
                continue;
            }

            if (receipt?.status === "reverted") {
                await this.assetLogRepository.revertSettlementToPending(
                    ids,
                    "Settlement tx reverted on-chain"
                );
                reverted += ids.length;
                continue;
            }

            // No receipt: a tx still known to a node may yet mine, so wait;
            // only a fully-dropped tx is safe to re-send.
            if (await this.rewardsHub.isTransactionKnown(txHash)) {
                pending += ids.length;
                continue;
            }

            await this.assetLogRepository.revertSettlementToPending(
                ids,
                "Settlement tx dropped from mempool"
            );
            reverted += ids.length;
        }

        log.info(
            { settled, reverted, pending },
            "Reconciled stuck settlement processing items"
        );

        return { settled, reverted, pending };
    }

    private async prepareRewards(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>
    ): Promise<PreparedSettlement> {
        const preparedRewards: PushRewardParams[] = [];
        const validAssetLogIds: string[] = [];
        const errors: { assetLogId: string; error: string }[] = [];

        const uniqueTokens = [
            ...new Set(
                rewards
                    .map((reward) => reward.tokenAddress)
                    .filter((token): token is Address => token !== null)
            ),
        ];
        const decimalsMap = new Map<Address, number>();
        await Promise.all(
            uniqueTokens.map(async (token) => {
                const decimals = await this.tokenMetadata.getDecimals({
                    token,
                });
                decimalsMap.set(token, decimals);
            })
        );

        for (const reward of rewards) {
            const validationError = this.validateReward(reward, merchantBanks);
            if (validationError) {
                errors.push({ assetLogId: reward.id, error: validationError });
                continue;
            }

            const tokenDecimals = decimalsMap.get(
                reward.tokenAddress as Address
            );
            if (tokenDecimals === undefined) {
                errors.push({
                    assetLogId: reward.id,
                    error: "Could not resolve token decimals",
                });
                continue;
            }

            const attestation = this.buildAttestationHex(reward);
            const amount = parseUnits(reward.amount, tokenDecimals);
            const token = reward.tokenAddress as Address;
            const bank = merchantBanks.get(reward.merchantId) as Address;

            validAssetLogIds.push(reward.id);

            preparedRewards.push({
                wallet: reward.walletAddress,
                amount,
                token,
                bank,
                attestation,
            });
        }

        return { rewards: preparedRewards, validAssetLogIds, errors };
    }

    private validateReward(
        reward: AssetLogWithWallet,
        merchantBanks: Map<string, Address>
    ): string | null {
        if (!merchantBanks.has(reward.merchantId)) {
            return "Merchant bank not found";
        }
        if (!reward.tokenAddress) {
            return "Token address not set";
        }
        return null;
    }

    private buildAttestationHex(reward: AssetLogWithWallet): Hex {
        const events = [
            { event: "reward_created", timestamp: reward.createdAt },
        ];

        if (reward.interactionType) {
            events.unshift({
                event: reward.interactionType,
                timestamp: reward.createdAt,
            });
        }

        const base64 = buildAttestation(events);
        return `0x${Buffer.from(base64).toString("hex")}` as Hex;
    }
}
