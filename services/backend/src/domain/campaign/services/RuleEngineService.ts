import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { AssetLogRepository } from "../../rewards/repositories/AssetLogRepository";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type {
    CalculatedReward,
    CampaignTrigger,
    EvaluationResult,
    ReferralChainFetcher,
    ReferralChainMember,
    RuleConditions,
    RuleContext,
    TimeContext,
} from "../types";
import type { RewardCalculator } from "./RewardCalculator";
import { roundAmount } from "./RewardCalculator";
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";

type EvaluateRulesParams = {
    merchantId: string;
    trigger: CampaignTrigger;
    context: Omit<RuleContext, "time">;
    time?: TimeContext;
    /** Fallback token for pricing percentage/tiered rewards that don't pin their own. */
    merchantDefaultToken?: Address;
};

export function buildTimeContext(date?: Date): TimeContext {
    const d = date ?? new Date();
    return {
        dayOfWeek: d.getUTCDay(),
        hourOfDay: d.getUTCHours(),
        date: d.toISOString().split("T")[0],
        timestamp: Math.floor(d.getTime() / 1000),
    };
}

export class RuleEngineService {
    constructor(
        private readonly repository: CampaignRuleRepository,
        private readonly conditionEvaluator: RuleConditionEvaluator,
        private readonly rewardCalculator: RewardCalculator,
        private readonly assetLogRepository: AssetLogRepository
    ) {}

    async evaluateRules(
        params: EvaluateRulesParams,
        fetchReferralChain?: ReferralChainFetcher
    ): Promise<EvaluationResult> {
        const fullContext: RuleContext = {
            ...params.context,
            time: params.time ?? buildTimeContext(),
        };

        const activeCampaigns = await this.repository.findActiveByMerchant(
            params.merchantId,
            params.trigger
        );

        if (activeCampaigns.length === 0) {
            return {
                rewards: [],
                budgetExceeded: false,
                skippedCampaigns: [],
                errors: [],
                deferForUnpriceableReward: false,
            };
        }

        // Pre-compute merchant-wide reward count if any campaign uses merchant cap
        const hasMerchantCap = activeCampaigns.some(
            (c) => c.rule.merchantMaxRewardsPerUser !== undefined
        );
        let merchantRewardCount: number | undefined;
        if (hasMerchantCap) {
            merchantRewardCount =
                await this.assetLogRepository.countByMerchantAndUserAsReferee(
                    params.merchantId,
                    fullContext.user.identityGroupId
                );
        }

        // Prefetch per-campaign referee counts in one grouped query instead of
        // one round-trip per capped campaign (N+1).
        const cappedCampaignIds = activeCampaigns
            .filter((c) => c.rule.maxRewardsPerUser !== undefined)
            .map((c) => c.id);
        let campaignRefereeCounts: Map<string, number> | undefined;
        if (cappedCampaignIds.length > 0) {
            campaignRefereeCounts =
                await this.assetLogRepository.countByCampaignsAndUserAsReferee(
                    cappedCampaignIds,
                    fullContext.user.identityGroupId
                );
        }

        const allRewards: CalculatedReward[] = [];
        const skippedCampaigns: string[] = [];
        const errors: { campaignRuleId: string; error: string }[] = [];
        let budgetExceeded = false;
        let deferForUnpriceableReward = false;
        let deferReason: string | undefined;

        for (const campaign of activeCampaigns) {
            const result = await this.evaluateSingleCampaign(
                campaign,
                fullContext,
                params.merchantId,
                merchantRewardCount,
                campaignRefereeCounts,
                fetchReferralChain,
                params.merchantDefaultToken
            );

            if (!result.matched) continue;

            deferForUnpriceableReward ||= result.deferForUnpriceableReward;
            deferReason ??= result.deferReason;

            if (result.errors.length > 0) {
                for (const error of result.errors) {
                    errors.push({ campaignRuleId: campaign.id, error });
                }
            }

            if (result.budgetExceeded) {
                budgetExceeded = true;
                skippedCampaigns.push(campaign.id);
                continue;
            }

            allRewards.push(...result.rewards);

            // Keep the merchant-wide per-user counter live across campaigns in
            // this same evaluation. Several campaigns for one merchant can match
            // a single interaction; each must see the referee rewards granted by
            // earlier ones, or the cap is overshot by (matching campaigns − 1).
            if (merchantRewardCount !== undefined) {
                merchantRewardCount += result.rewards.filter(
                    (reward) => reward.recipient === "referee"
                ).length;
            }
        }

        return {
            rewards: allRewards,
            budgetExceeded,
            skippedCampaigns,
            errors,
            deferForUnpriceableReward,
            deferReason,
        };
    }

    // Evaluated with each item as the root object (`field: "productId"`, not
    // `field: "purchase.items.productId"`). Returns the (possibly enriched)
    // context when the scope is absent or at least one item matches, and
    // `undefined` when a present scope matches no item (campaign shouldn't
    // match — caller treats this as a `matched: false` result).
    private applyProductScope(
        productScope: RuleConditions | undefined,
        context: RuleContext
    ): RuleContext | undefined {
        if (!productScope) return context;

        const { purchase } = context;
        const items = purchase?.items ?? [];
        const matchedItems = items.filter((item) =>
            this.conditionEvaluator.evaluateAgainst(productScope, item)
        );

        // A non-empty matchedItems implies items came from a defined
        // purchase, but narrow explicitly rather than casting below so the
        // compiler (not just the reachability argument) knows `purchase` is
        // defined once we build the scoped context.
        if (!purchase || matchedItems.length === 0) {
            return undefined;
        }

        return {
            ...context,
            purchase: {
                ...purchase,
                matchedAmount: roundAmount(
                    matchedItems.reduce((sum, item) => sum + item.totalPrice, 0)
                ),
                matchedQuantity: matchedItems.reduce(
                    (sum, item) => sum + item.quantity,
                    0
                ),
            },
        };
    }

    private async evaluateSingleCampaign(
        campaign: CampaignRuleSelect,
        context: RuleContext,
        merchantId: string,
        merchantRewardCount: number | undefined,
        campaignRefereeCounts: Map<string, number> | undefined,
        fetchReferralChain?: ReferralChainFetcher,
        merchantDefaultToken?: Address
    ): Promise<{
        matched: boolean;
        rewards: CalculatedReward[];
        budgetExceeded: boolean;
        errors: string[];
        deferForUnpriceableReward: boolean;
        deferReason?: string;
    }> {
        const conditionsMatch = this.conditionEvaluator.evaluate(
            campaign.rule.conditions,
            context
        );

        if (!conditionsMatch) {
            return {
                matched: false,
                rewards: [],
                budgetExceeded: false,
                errors: [],
                deferForUnpriceableReward: false,
            };
        }

        // productScope: the campaign only matches if at least one purchase
        // line item satisfies the scope conditions. No purchase context (or
        // no items) on a scoped campaign means it never matches — this also
        // covers non-purchase triggers, which never carry items.
        const scopedContext = this.applyProductScope(
            campaign.rule.productScope,
            context
        );
        if (!scopedContext) {
            return {
                matched: false,
                rewards: [],
                budgetExceeded: false,
                errors: [],
                deferForUnpriceableReward: false,
            };
        }

        // Check merchant-wide per-user cap (across all campaigns for this merchant)
        if (
            campaign.rule.merchantMaxRewardsPerUser !== undefined &&
            merchantRewardCount !== undefined &&
            merchantRewardCount >= campaign.rule.merchantMaxRewardsPerUser
        ) {
            log.debug(
                {
                    campaignId: campaign.id,
                    identityGroupId: context.user.identityGroupId,
                    merchantRewardCount,
                    merchantMaxRewardsPerUser:
                        campaign.rule.merchantMaxRewardsPerUser,
                },
                "Merchant-wide per-user reward cap reached"
            );
            return {
                matched: true,
                rewards: [],
                budgetExceeded: false,
                errors: [],
                deferForUnpriceableReward: false,
            };
        }

        // Check per-campaign per-user cap (only if explicitly set)
        if (campaign.rule.maxRewardsPerUser !== undefined) {
            const userRewardCount =
                campaignRefereeCounts?.get(campaign.id) ?? 0;

            if (userRewardCount >= campaign.rule.maxRewardsPerUser) {
                log.debug(
                    {
                        campaignId: campaign.id,
                        identityGroupId: context.user.identityGroupId,
                        userRewardCount,
                        maxPerUser: campaign.rule.maxRewardsPerUser,
                    },
                    "Per-campaign per-user reward cap reached"
                );
                return {
                    matched: true,
                    rewards: [],
                    budgetExceeded: false,
                    errors: [],
                    deferForUnpriceableReward: false,
                };
            }
        }

        const hasChainedReward = campaign.rule.rewards.some(
            (r) => r.recipient === "referrer" && r.chaining
        );

        let referralChain: ReferralChainMember[] | undefined;
        if (hasChainedReward && fetchReferralChain) {
            const maxDepth = Math.max(
                ...campaign.rule.rewards
                    .filter((r) => r.recipient === "referrer" && r.chaining)
                    .map((r) => r.chaining?.maxDepth ?? 5)
            );
            referralChain = await fetchReferralChain({
                merchantId,
                identityGroupId: context.user.identityGroupId,
                maxDepth,
            });
        }

        const { calculated, errors, deferForUnpriceableReward, deferReason } =
            await this.rewardCalculator.calculateAll(
                campaign.rule.rewards,
                scopedContext,
                campaign.id,
                referralChain,
                campaign.rule.pendingRewardExpirationDays,
                campaign.rule.defaultLockupSeconds,
                merchantDefaultToken
            );

        // Unpriceable reward: bail before consuming budget so the
        // orchestrator can leave the interaction unprocessed for a later retry.
        if (deferForUnpriceableReward) {
            return {
                matched: true,
                rewards: [],
                budgetExceeded: false,
                errors,
                deferForUnpriceableReward: true,
                deferReason,
            };
        }

        if (calculated.length === 0) {
            return {
                matched: true,
                rewards: [],
                budgetExceeded: false,
                errors,
                deferForUnpriceableReward: false,
            };
        }

        const totalAmount = calculated.reduce((sum, r) => sum + r.amount, 0);

        const budgetResult = await this.repository.consumeBudget(
            campaign.id,
            totalAmount
        );

        if (!budgetResult.success) {
            log.warn(
                {
                    campaignId: campaign.id,
                    requestedAmount: totalAmount,
                    reason: budgetResult.reason,
                },
                "Budget exceeded for campaign"
            );
            return {
                matched: true,
                rewards: [],
                budgetExceeded: true,
                errors,
                deferForUnpriceableReward: false,
            };
        }

        log.debug(
            {
                campaignId: campaign.id,
                rewardCount: calculated.length,
                totalAmount,
                remaining: budgetResult.remaining,
            },
            "Campaign rules evaluated successfully"
        );

        return {
            matched: true,
            rewards: calculated,
            budgetExceeded: false,
            errors,
            deferForUnpriceableReward: false,
        };
    }
}
