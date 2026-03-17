import { log } from "@backend-infrastructure";
import { currentStablecoinsList } from "@frak-labs/app-essentials";
import { type Address, getAddress } from "viem";
import type { CampaignBankRepository } from "../domain/campaign-bank/repositories/CampaignBankRepository";
import type { IdentityRepository } from "../domain/identity/repositories/IdentityRepository";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import { RewardConfig } from "../domain/rewards/config";
import type { AssetLogSelect } from "../domain/rewards/db/schema";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type {
    AssetLogWithWallet,
    SettlementService,
} from "../domain/rewards/services/SettlementService";
import type { SettlementResult } from "../domain/rewards/types";
import type { NotificationOrchestrator } from "./NotificationOrchestrator";

const defaultSettlementResult: SettlementResult = {
    settledCount: 0,
    failedCount: 0,
    txHashes: [],
    errors: [],
    banks: new Set(),
};

export class SettlementOrchestrator {
    constructor(
        private readonly settlementService: SettlementService,
        private readonly assetLogRepository: AssetLogRepository,
        private readonly merchantRepository: MerchantRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly campaignBankRepository: CampaignBankRepository,
        private readonly notificationOrchestrator: NotificationOrchestrator
    ) {}

    async runSettlement(): Promise<SettlementResult> {
        const resetCount =
            await this.assetLogRepository.resetStuckSettlementProcessing(
                RewardConfig.settlement.stuckThresholdMinutes
            );
        if (resetCount > 0) {
            log.info({ resetCount }, "Reset stuck settlement processing items");
        }

        const pendingAssetLogs =
            await this.assetLogRepository.findPendingForSettlement(
                RewardConfig.settlement.batchSize
            );

        if (pendingAssetLogs.length === 0) {
            log.debug("No pending rewards to settle");
            return defaultSettlementResult;
        }

        const pendingRewards =
            await this.enrichWithWalletAndInteraction(pendingAssetLogs);

        if (pendingRewards.length === 0) {
            log.warn(
                "No rewards could be enriched with wallet addresses, skipping settlement"
            );
            return defaultSettlementResult;
        }

        const merchantBanks = await this.getMerchantBanks(pendingRewards);

        const bankStates = new Map<
            Address,
            {
                isOpen: boolean;
                balances: Map<Address, bigint>;
                allowances: Map<Address, bigint>;
            }
        >();

        await Promise.all(
            [...merchantBanks.entries()].map(async ([, bankAddress]) => {
                const state =
                    await this.campaignBankRepository.getBankOnChainState(
                        bankAddress,
                        currentStablecoinsList
                    );
                bankStates.set(bankAddress, state);
            })
        );

        const distributableRewards: AssetLogWithWallet[] = [];
        const depletedRewards: AssetLogWithWallet[] = [];

        for (const reward of pendingRewards) {
            const isBankCapable = this.isBankCapableForReward(
                reward,
                merchantBanks,
                bankStates
            );

            if (isBankCapable) {
                distributableRewards.push(reward);
            } else {
                depletedRewards.push(reward);
            }
        }

        if (depletedRewards.length > 0) {
            const depletedIds = depletedRewards.map((reward) => reward.id);
            await this.assetLogRepository.updateStatusBatch(
                depletedIds,
                "bank_depleted"
            );

            log.info(
                {
                    depletedCount: depletedRewards.length,
                    merchantIds: [
                        ...new Set(
                            depletedRewards.map((reward) => reward.merchantId)
                        ),
                    ],
                },
                "Rewards skipped due to depleted or closed banks"
            );
        }

        if (distributableRewards.length === 0) {
            log.debug("No distributable rewards after bank pre-flight check");
            return {
                ...defaultSettlementResult,
                failedCount: depletedRewards.length,
                errors: depletedRewards.map((reward) => ({
                    assetLogId: reward.id,
                    error: "Bank depleted or closed",
                })),
            };
        }

        const results = await this.settlementService.settleRewards(
            distributableRewards,
            merchantBanks
        );

        if (results.settledCount > 0) {
            this.sendRewardSettledNotifications(distributableRewards).catch(
                (error) =>
                    log.warn(
                        { error },
                        "Failed to send reward settled notifications"
                    )
            );
        }

        // Invalidate all the banks cache for the results
        for (const bank of results.banks.values()) {
            this.campaignBankRepository.clearOnChainCache(bank);
        }

        return results;
    }

    private async enrichWithWalletAndInteraction(
        assetLogs: AssetLogSelect[]
    ): Promise<AssetLogWithWallet[]> {
        const uniqueGroupIds = [
            ...new Set(assetLogs.map((r) => r.identityGroupId)),
        ];
        const walletMap = new Map<string, Address | null>();
        await Promise.all(
            uniqueGroupIds.map(async (groupId) => {
                const wallet =
                    await this.identityRepository.getWalletForGroup(groupId);
                walletMap.set(groupId, wallet);
            })
        );

        const interactionLogIds = assetLogs
            .map((r) => r.interactionLogId)
            .filter((id): id is string => id !== null);
        const interactionTypeMap =
            await this.interactionLogRepository.getTypesByIds([
                ...new Set(interactionLogIds),
            ]);

        const results: AssetLogWithWallet[] = [];
        for (const assetLog of assetLogs) {
            const walletAddress = walletMap.get(assetLog.identityGroupId);
            if (!walletAddress) {
                log.warn(
                    {
                        assetLogId: assetLog.id,
                        groupId: assetLog.identityGroupId,
                    },
                    "Skipping reward: no wallet found for identity group"
                );
                continue;
            }

            results.push({
                ...assetLog,
                walletAddress,
                interactionType: assetLog.interactionLogId
                    ? (interactionTypeMap.get(assetLog.interactionLogId) ??
                      null)
                    : null,
            });
        }

        return results;
    }

    private async getMerchantBanks(
        rewards: AssetLogWithWallet[]
    ): Promise<Map<string, Address>> {
        const merchantIds = [...new Set(rewards.map((r) => r.merchantId))];
        return this.merchantRepository.getBankAddresses(merchantIds);
    }

    private isBankCapableForReward(
        reward: AssetLogWithWallet,
        merchantBanks: Map<string, Address>,
        bankStates: Map<
            Address,
            {
                isOpen: boolean;
                balances: Map<Address, bigint>;
                allowances: Map<Address, bigint>;
            }
        >
    ) {
        const bankAddress = merchantBanks.get(reward.merchantId);
        if (!bankAddress) {
            return false;
        }

        const bankState = bankStates.get(bankAddress);
        if (!bankState || !bankState.isOpen) {
            return false;
        }

        const rewardToken = getAddress(reward.tokenAddress as Address);
        const tokenBalance = bankState.balances.get(rewardToken) ?? 0n;
        const tokenAllowance = bankState.allowances.get(rewardToken) ?? 0n;
        if (tokenBalance === 0n || tokenAllowance === 0n) {
            return false;
        }

        return true;
    }

    private async sendRewardSettledNotifications(
        rewards: AssetLogWithWallet[]
    ) {
        if (rewards.length === 0) return;

        const merchantIds = [...new Set(rewards.map((r) => r.merchantId))];
        const merchantNames = new Map<string, string>();
        await Promise.all(
            merchantIds.map(async (id) => {
                const merchant = await this.merchantRepository.findById(id);
                if (merchant?.name) {
                    merchantNames.set(id, merchant.name);
                }
            })
        );

        const byWallet = new Map<
            Address,
            { merchantId: string; count: number }
        >();
        for (const reward of rewards) {
            const existing = byWallet.get(reward.walletAddress);
            if (existing) {
                existing.count++;
            } else {
                byWallet.set(reward.walletAddress, {
                    merchantId: reward.merchantId,
                    count: 1,
                });
            }
        }

        const notifications = [...byWallet.entries()].map(
            ([wallet, { merchantId, count }]) => ({
                wallets: [wallet] as Address[],
                template: {
                    type: "reward_settled" as const,
                    merchantName: merchantNames.get(merchantId) ?? "a merchant",
                    rewardCount: count,
                },
            })
        );

        await this.notificationOrchestrator.sendNotifications(notifications);
    }
}
