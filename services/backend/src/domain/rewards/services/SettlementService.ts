import { log } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import {
    type LockRewardParams,
    type PushRewardParams,
    type RewardsHubRepository,
    rewardsHubRepository,
} from "../../../infrastructure/blockchain/contracts/RewardsHubRepository";
import { MerchantRepository } from "../../merchant/repositories/MerchantRepository";
import type { AssetLogSelect } from "../db/schema";
import { AssetLogRepository } from "../repositories/AssetLogRepository";
import {
    buildAttestation,
    encodeUserId,
    type SettlementResult,
} from "../types";

const DEFAULT_TOKEN_DECIMALS = 18;
const SETTLEMENT_BATCH_SIZE = 100;

type AssetLogWithWallet = AssetLogSelect & { walletAddress: Address | null };

export class SettlementService {
    private readonly assetLogRepository: AssetLogRepository;
    private readonly merchantRepository: MerchantRepository;
    private readonly rewardsHub: RewardsHubRepository;

    constructor(
        assetLogRepository?: AssetLogRepository,
        merchantRepository?: MerchantRepository,
        rewardsHub?: RewardsHubRepository
    ) {
        this.assetLogRepository =
            assetLogRepository ?? new AssetLogRepository();
        this.merchantRepository =
            merchantRepository ?? new MerchantRepository();
        this.rewardsHub = rewardsHub ?? rewardsHubRepository;
    }

    async settleRewards(): Promise<SettlementResult> {
        const result: SettlementResult = {
            pushedCount: 0,
            lockedCount: 0,
            failedCount: 0,
            txHashes: [],
            errors: [],
        };

        const pendingRewards =
            await this.assetLogRepository.findPendingForSettlement(
                SETTLEMENT_BATCH_SIZE
            );

        if (pendingRewards.length === 0) {
            log.debug("No pending rewards to settle");
            return result;
        }

        const merchantBanks = await this.getMerchantBanks(pendingRewards);
        const { pushRewards, lockRewards, validAssetLogIds, errors } =
            this.prepareRewards(pendingRewards, merchantBanks);

        result.failedCount = errors.length;
        result.errors = errors;

        if (pushRewards.length === 0 && lockRewards.length === 0) {
            return result;
        }

        try {
            const txResult = await this.rewardsHub.batchRewards(
                pushRewards,
                lockRewards
            );

            result.txHashes.push(txResult.txHash);
            result.pushedCount = pushRewards.length;
            result.lockedCount = lockRewards.length;

            await this.assetLogRepository.updateStatusBatch(
                validAssetLogIds,
                "ready_to_claim",
                { txHash: txResult.txHash, blockNumber: txResult.blockNumber }
            );
        } catch (error) {
            log.error(
                {
                    error,
                    pushCount: pushRewards.length,
                    lockCount: lockRewards.length,
                },
                "Failed to execute batch settlement"
            );
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            for (const assetLogId of validAssetLogIds) {
                result.errors.push({ assetLogId, error: errorMessage });
            }
            result.failedCount += validAssetLogIds.length;
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

    private async getMerchantBanks(
        rewards: AssetLogWithWallet[]
    ): Promise<Map<string, Address>> {
        const merchantBanks = new Map<string, Address>();

        for (const reward of rewards) {
            if (merchantBanks.has(reward.merchantId)) continue;

            const merchant = await this.merchantRepository.findById(
                reward.merchantId
            );
            if (merchant?.bankAddress) {
                merchantBanks.set(reward.merchantId, merchant.bankAddress);
            }
        }

        return merchantBanks;
    }

    private prepareRewards(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>
    ): {
        pushRewards: PushRewardParams[];
        lockRewards: LockRewardParams[];
        validAssetLogIds: string[];
        errors: Array<{ assetLogId: string; error: string }>;
    } {
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

    private buildAttestationHex(reward: AssetLogSelect): Hex {
        const events = [
            { event: "reward_created", timestamp: reward.createdAt },
        ];

        if (reward.purchaseId) {
            events.unshift({ event: "purchase", timestamp: reward.createdAt });
        }

        const base64 = buildAttestation(events);
        return `0x${Buffer.from(base64).toString("hex")}` as Hex;
    }
}
