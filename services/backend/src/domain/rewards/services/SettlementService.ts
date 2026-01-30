import type { TokenMetadataRepository } from "@backend-infrastructure";
import { log } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import type {
    PushRewardParams,
    RewardsHubRepository,
} from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
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
    errors: Array<{ assetLogId: string; error: string }>;
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

        await this.assetLogRepository.markSettlementProcessing(
            prepared.validAssetLogIds
        );

        try {
            const txResult = await this.rewardsHub.pushRewards(
                prepared.rewards
            );

            result.txHashes.push(txResult.txHash);
            result.settledCount = prepared.rewards.length;

            await this.assetLogRepository.updateStatusBatch(
                prepared.validAssetLogIds,
                "settled",
                { txHash: txResult.txHash, blockNumber: txResult.blockNumber }
            );
        } catch (error) {
            log.error(
                {
                    error,
                    count: prepared.rewards.length,
                },
                "Failed to execute settlement, will retry on next run"
            );

            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";

            await this.assetLogRepository.revertSettlementToPending(
                prepared.validAssetLogIds,
                errorMessage
            );

            for (const assetLogId of prepared.validAssetLogIds) {
                result.errors.push({ assetLogId, error: errorMessage });
            }
            result.failedCount += prepared.validAssetLogIds.length;
            result.settledCount = 0;
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

    private async prepareRewards(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>
    ): Promise<PreparedSettlement> {
        const preparedRewards: PushRewardParams[] = [];
        const validAssetLogIds: string[] = [];
        const errors: Array<{ assetLogId: string; error: string }> = [];

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
