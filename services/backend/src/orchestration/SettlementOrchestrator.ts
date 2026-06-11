import {
    eventEmitter,
    log,
    type TokenMetadataRepository,
} from "@backend-infrastructure";
import { currentStablecoinsList } from "@frak-labs/app-essentials";
import { type Address, getAddress, parseUnits } from "viem";
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

const defaultSettlementResult: SettlementResult = {
    settledCount: 0,
    failedCount: 0,
    txHashes: [],
    errors: [],
    banks: new Set(),
    settledAssetLogIds: [],
};

export class SettlementOrchestrator {
    constructor(
        private readonly settlementService: SettlementService,
        private readonly assetLogRepository: AssetLogRepository,
        private readonly merchantRepository: MerchantRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly campaignBankRepository: CampaignBankRepository,
        private readonly tokenMetadata: TokenMetadataRepository
    ) {}

    async runSettlement(): Promise<SettlementResult> {
        await this.settlementService.reconcileStuckSettlements(
            RewardConfig.settlement.stuckThresholdMinutes
        );

        const claimedAssetLogs =
            await this.assetLogRepository.claimPendingForSettlement(
                RewardConfig.settlement.batchSize
            );

        if (claimedAssetLogs.length === 0) {
            log.debug("No pending rewards to settle");
            return defaultSettlementResult;
        }

        const { enriched: pendingRewards, skippedIds } =
            await this.enrichWithWalletAndInteraction(claimedAssetLogs);

        if (skippedIds.length > 0) {
            await this.assetLogRepository.bumpAttemptAndRevert(
                skippedIds,
                "No wallet for identity group"
            );
        }

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

        const settledIds = new Set(results.settledAssetLogIds);
        const settledRewards = distributableRewards.filter((reward) =>
            settledIds.has(reward.id)
        );
        if (settledRewards.length > 0) {
            try {
                this.sendRewardSettledNotifications(settledRewards);
            } catch (error) {
                log.warn(
                    { error },
                    "Failed to send reward settled notifications"
                );
            }
        }

        // Invalidate all the banks cache for the results
        for (const bank of results.banks.values()) {
            this.campaignBankRepository.clearOnChainCache(bank);
        }

        return results;
    }

    /**
     * Requeue `bank_depleted` rewards whose bank can pay again. Runs on its own
     * slow cron, off the settlement hot path, so a dead bank's backlog never
     * churns through settlement batches. Per (merchant, token) group it
     * re-reads live bank state (cache forced fresh — the LRU would otherwise
     * feed stale zeros) and requeues only when the bank is open and holds
     * balance AND allowance >= the smallest depleted reward, i.e. at least one
     * reward can actually settle. Emits `newPendingRewards` so the settlement
     * cron drains them immediately instead of waiting for its next tick.
     */
    async requeueDepletedRewards(): Promise<{ requeuedCount: number }> {
        const groups =
            await this.assetLogRepository.findDepletedAmountsByMerchantAndToken();
        if (groups.length === 0) {
            return { requeuedCount: 0 };
        }

        const merchantIds = [
            ...new Set(groups.map((group) => group.merchantId)),
        ];
        const merchantBanks =
            await this.merchantRepository.getBankAddresses(merchantIds);

        const bankStates = new Map<
            Address,
            Awaited<ReturnType<CampaignBankRepository["getBankOnChainState"]>>
        >();
        await Promise.all(
            [...new Set(merchantBanks.values())].map(async (bank) => {
                this.campaignBankRepository.clearOnChainCache(bank);
                bankStates.set(
                    bank,
                    await this.campaignBankRepository.getBankOnChainState(
                        bank,
                        currentStablecoinsList
                    )
                );
            })
        );

        const decimalsByToken = new Map<Address, number>();
        await Promise.all(
            [...new Set(groups.map((group) => group.tokenAddress))].map(
                async (token) => {
                    decimalsByToken.set(
                        token,
                        await this.tokenMetadata.getDecimals({ token })
                    );
                }
            )
        );

        const requeueable = groups.filter((group) => {
            const bank = merchantBanks.get(group.merchantId);
            if (!bank) return false;

            const state = bankStates.get(bank);
            if (!state?.isOpen) return false;

            const decimals = decimalsByToken.get(group.tokenAddress);
            if (decimals === undefined) return false;

            const token = getAddress(group.tokenAddress);
            const minWei = parseUnits(group.minAmount, decimals);
            return (
                (state.balances.get(token) ?? 0n) >= minWei &&
                (state.allowances.get(token) ?? 0n) >= minWei
            );
        });

        if (requeueable.length === 0) {
            return { requeuedCount: 0 };
        }

        const requeuedCount =
            await this.assetLogRepository.requeueDepletedToPending(
                requeueable.map((group) => ({
                    merchantId: group.merchantId,
                    tokenAddress: group.tokenAddress,
                }))
            );

        if (requeuedCount > 0) {
            eventEmitter.emit("newPendingRewards", { count: requeuedCount });
        }

        return { requeuedCount };
    }

    private async enrichWithWalletAndInteraction(
        assetLogs: AssetLogSelect[]
    ): Promise<{ enriched: AssetLogWithWallet[]; skippedIds: string[] }> {
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

        const enriched: AssetLogWithWallet[] = [];
        const skippedIds: string[] = [];
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
                skippedIds.push(assetLog.id);
                continue;
            }

            enriched.push({
                ...assetLog,
                walletAddress,
                interactionType: assetLog.interactionLogId
                    ? (interactionTypeMap.get(assetLog.interactionLogId) ??
                      null)
                    : null,
            });
        }

        return { enriched, skippedIds };
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
        if (!bankState?.isOpen) {
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

    private sendRewardSettledNotifications(rewards: AssetLogWithWallet[]) {
        if (rewards.length === 0) return;

        const byWalletAndMerchant = new Map<`${Address}:${string}`, number>();
        for (const reward of rewards) {
            const key =
                `${reward.walletAddress}:${reward.merchantId}` satisfies `${Address}:${string}`;
            byWalletAndMerchant.set(
                key,
                (byWalletAndMerchant.get(key) ?? 0) + 1
            );
        }

        eventEmitter.emit("notification", {
            type: "reward_settled",
            notifications: [...byWalletAndMerchant.entries()].map(
                ([walletAndMerchant, count]) => {
                    const [wallet, merchantId] = walletAndMerchant.split(":");
                    return {
                        wallets: [wallet] as Address[],
                        merchantId,
                        rewardCount: count,
                    };
                }
            ),
        });
    }
}
