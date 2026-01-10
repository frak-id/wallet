import { log } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import type {
    LockRewardParams,
    PushRewardParams,
    RewardsHubRepository,
} from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
import type { AssetLogSelect } from "../db/schema";
import type { AssetLogRepository } from "../repositories/AssetLogRepository";
import {
    buildAttestation,
    encodeUserId,
    type InteractionType,
    type SettlementResult,
} from "../types";

const DEFAULT_TOKEN_DECIMALS = 18;

export type AssetLogWithWallet = AssetLogSelect & {
    walletAddress: Address | null;
    interactionType: InteractionType | null;
};

type PreparedSettlement = {
    pushRewards: PushRewardParams[];
    lockRewards: LockRewardParams[];
    validAssetLogIds: string[];
    errors: Array<{ assetLogId: string; error: string }>;
};

/**
 * Pure rewards domain service for settlement.
 * Cross-domain coordination (merchant bank lookup) is handled by SettlementOrchestrator.
 */
export class SettlementService {
    constructor(
        private readonly assetLogRepository: AssetLogRepository,
        private readonly rewardsHub: RewardsHubRepository
    ) {}

    async settleRewards(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>
    ): Promise<SettlementResult> {
        const result: SettlementResult = {
            pushedCount: 0,
            lockedCount: 0,
            failedCount: 0,
            txHashes: [],
            errors: [],
        };

        if (rewards.length === 0) {
            log.debug("No rewards to settle");
            return result;
        }

        const prepared = this.prepareRewards(rewards, merchantBanks);

        result.failedCount = prepared.errors.length;
        result.errors = prepared.errors;

        if (
            prepared.pushRewards.length === 0 &&
            prepared.lockRewards.length === 0
        ) {
            return result;
        }

        try {
            const txResult = await this.rewardsHub.batchRewards(
                prepared.pushRewards,
                prepared.lockRewards
            );

            result.txHashes.push(txResult.txHash);
            result.pushedCount = prepared.pushRewards.length;
            result.lockedCount = prepared.lockRewards.length;

            await this.assetLogRepository.updateStatusBatch(
                prepared.validAssetLogIds,
                "ready_to_claim",
                { txHash: txResult.txHash, blockNumber: txResult.blockNumber }
            );
        } catch (error) {
            log.error(
                {
                    error,
                    pushCount: prepared.pushRewards.length,
                    lockCount: prepared.lockRewards.length,
                },
                "Failed to execute batch settlement"
            );

            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";

            for (const assetLogId of prepared.validAssetLogIds) {
                result.errors.push({ assetLogId, error: errorMessage });
            }
            result.failedCount += prepared.validAssetLogIds.length;
            result.pushedCount = 0;
            result.lockedCount = 0;
        }

        log.info(
            {
                pushed: result.pushedCount,
                locked: result.lockedCount,
                failed: result.failedCount,
                txCount: result.txHashes.length,
            },
            "Settlement batch completed"
        );

        return result;
    }

    private prepareRewards(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>
    ): PreparedSettlement {
        const pushRewards: PushRewardParams[] = [];
        const lockRewards: LockRewardParams[] = [];
        const validAssetLogIds: string[] = [];
        const errors: Array<{ assetLogId: string; error: string }> = [];

        for (const reward of rewards) {
            const validationError = this.validateReward(reward, merchantBanks);
            if (validationError) {
                errors.push({ assetLogId: reward.id, error: validationError });
                continue;
            }

            const attestation = this.buildAttestationHex(reward);
            const amount = parseUnits(reward.amount, DEFAULT_TOKEN_DECIMALS);
            const token = reward.tokenAddress as Address;
            const bank = merchantBanks.get(reward.merchantId) as Address;

            validAssetLogIds.push(reward.id);

            if (reward.walletAddress) {
                pushRewards.push({
                    wallet: reward.walletAddress,
                    amount,
                    token,
                    bank,
                    attestation,
                });
            } else {
                lockRewards.push({
                    userId: encodeUserId(reward.identityGroupId),
                    amount,
                    token,
                    bank,
                    attestation,
                });
            }
        }

        return { pushRewards, lockRewards, validAssetLogIds, errors };
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
