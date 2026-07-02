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

type BankOnChainState = Awaited<
    ReturnType<CampaignBankRepository["getBankOnChainState"]>
>;

type RewardCapacityGroup = {
    capacity: bigint;
    rewards: { reward: AssetLogWithWallet; amountWei: bigint }[];
};

// Greedy smallest-first fill of one (bank, token) group under its capacity —
// see selectDistributableRewards for why the batch must stay within capacity.
function capRewardsToCapacity(
    group: RewardCapacityGroup,
    distributableRewards: AssetLogWithWallet[],
    depletedRewards: AssetLogWithWallet[]
): void {
    group.rewards.sort((a, b) => compareBigInt(a.amountWei, b.amountWei));

    let runningTotal = 0n;
    for (const { reward, amountWei } of group.rewards) {
        if (runningTotal + amountWei <= group.capacity) {
            runningTotal += amountWei;
            distributableRewards.push(reward);
        } else {
            depletedRewards.push(reward);
        }
    }
}

function compareBigInt(a: bigint, b: bigint): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

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

        // `claimPendingForSettlement` already gates on an active wallet node,
        // so a skipped row here means the wallet was unlinked between claim and
        // enrichment (a rare concurrent merge/unlink). No wallet is a transient
        // "not yet" state, never a permanent invalid, so revert WITHOUT spending
        // an attempt — `bumpAttemptAndRevert` would burn `maxAttempts` and
        // forfeit owed rewards at expiry even after the wallet reappears.
        if (skippedIds.length > 0) {
            await this.assetLogRepository.revertSettlementToPending(
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

        const bankStates = await this.readFreshBankStates(
            merchantBanks.values()
        );

        const { distributableRewards, depletedRewards } =
            await this.selectDistributableRewards(
                pendingRewards,
                merchantBanks,
                bankStates
            );

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
                depletedCount: depletedRewards.length,
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

        return { ...results, depletedCount: depletedRewards.length };
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

        const bankStates = await this.readFreshBankStates(
            merchantBanks.values()
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

    /**
     * Read live bank state with the 10-min LRU forced fresh: it could
     * otherwise report a bank drained by an earlier run (or another replica)
     * as still funded, passing pre-flight only for the on-chain push to fail
     * and burn an attempt. Banks shared across merchants are deduped so each
     * is read once.
     */
    private async readFreshBankStates(
        bankAddresses: Iterable<Address>
    ): Promise<Map<Address, BankOnChainState>> {
        const bankStates = new Map<Address, BankOnChainState>();
        await Promise.all(
            [...new Set(bankAddresses)].map(async (bank) => {
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
        return bankStates;
    }

    /**
     * Split rewards into what the bank can actually pay this run vs. what to
     * defer as `bank_depleted`. The on-chain push is ONE atomic batch tx per
     * bank, so a batch whose total exceeds the bank's live balance/allowance
     * reverts wholesale and burns an attempt on every row. Grouped per
     * (bank, token) — each token draws on its own balance/allowance — rewards
     * are admitted smallest-first while the running total stays within
     * min(balance, allowance), maximising how many settle; the rest defer for
     * the requeue cron once the bank refills.
     */
    private async selectDistributableRewards(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>,
        bankStates: Map<Address, BankOnChainState>
    ): Promise<{
        distributableRewards: AssetLogWithWallet[];
        depletedRewards: AssetLogWithWallet[];
    }> {
        const decimalsByToken = await this.resolveTokenDecimals(
            rewards
                .map((reward) => reward.tokenAddress)
                .filter((token): token is Address => token !== null)
        );

        const { groups, depletedRewards } = this.groupRewardsByBankToken(
            rewards,
            merchantBanks,
            bankStates,
            decimalsByToken
        );

        const distributableRewards: AssetLogWithWallet[] = [];
        for (const group of groups.values()) {
            capRewardsToCapacity(group, distributableRewards, depletedRewards);
        }

        return { distributableRewards, depletedRewards };
    }

    private groupRewardsByBankToken(
        rewards: AssetLogWithWallet[],
        merchantBanks: Map<string, Address>,
        bankStates: Map<Address, BankOnChainState>,
        decimalsByToken: Map<Address, number>
    ): {
        groups: Map<string, RewardCapacityGroup>;
        depletedRewards: AssetLogWithWallet[];
    } {
        const groups = new Map<string, RewardCapacityGroup>();
        const depletedRewards: AssetLogWithWallet[] = [];

        for (const reward of rewards) {
            const context = this.resolveRewardBankContext(
                reward,
                merchantBanks,
                bankStates,
                decimalsByToken
            );
            // No context = missing/closed bank or unresolved token/decimals:
            // can never settle this run, so defer rather than sink the batch.
            if (!context) {
                depletedRewards.push(reward);
                continue;
            }

            const entry = { reward, amountWei: context.amountWei };
            const group = groups.get(context.key);
            if (group) {
                group.rewards.push(entry);
            } else {
                groups.set(context.key, {
                    capacity: context.capacity,
                    rewards: [entry],
                });
            }
        }

        return { groups, depletedRewards };
    }

    private resolveRewardBankContext(
        reward: AssetLogWithWallet,
        merchantBanks: Map<string, Address>,
        bankStates: Map<Address, BankOnChainState>,
        decimalsByToken: Map<Address, number>
    ): { key: string; capacity: bigint; amountWei: bigint } | null {
        const bank = merchantBanks.get(reward.merchantId);
        const state = bank ? bankStates.get(bank) : undefined;
        const token =
            reward.tokenAddress !== null
                ? getAddress(reward.tokenAddress)
                : undefined;
        const decimals =
            token !== undefined ? decimalsByToken.get(token) : undefined;

        if (!bank || !state?.isOpen || !token || decimals === undefined) {
            return null;
        }

        const balance = state.balances.get(token) ?? 0n;
        const allowance = state.allowances.get(token) ?? 0n;
        return {
            key: `${bank}:${token}`,
            capacity: balance < allowance ? balance : allowance,
            amountWei: parseUnits(reward.amount, decimals),
        };
    }

    private async resolveTokenDecimals(
        tokens: Address[]
    ): Promise<Map<Address, number>> {
        const decimalsByToken = new Map<Address, number>();
        await Promise.all(
            [...new Set(tokens.map((token) => getAddress(token)))].map(
                async (token) => {
                    decimalsByToken.set(
                        token,
                        await this.tokenMetadata.getDecimals({ token })
                    );
                }
            )
        );
        return decimalsByToken;
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
