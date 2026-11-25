import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import { roundAmount } from "../../../utils/numeric";
import type { AssetLogRepository } from "../../rewards/repositories/AssetLogRepository";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import { DEFAULT_SUBSCRIPTION_INACTIVITY_DAYS } from "../schemas";
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
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";

type SingleCampaignResult = {
    matched: boolean;
    rewards: CalculatedReward[];
    budgetExceeded: boolean;
    errors: string[];
    deferForUnpriceableReward: boolean;
    deferReason?: string;
    /**
     * Order-level conditions matched but the product scope selected no line
     * item — the campaign's own filter excluded the cart, not the cart the
     * campaign. Reported so support can tell it from "no eligible purchase".
     */
    scopeMatchedNoItem?: boolean;
};

type ProductScopeOutcome = {
    context: RuleContext | undefined;
    reason?: "no_purchase" | "scope_matched_no_item";
};

/** Flags a campaign whose product scope selected no line item. */
function holdIfRequired(
    campaign: CampaignRuleSelect,
    rewards: CalculatedReward[]
): CalculatedReward[] {
    if (!campaign.rule.holdUntilReleased) return rewards;
    return rewards.map((reward) => ({ ...reward, held: true }));
}

/** A plan prices every step on one billing cycle, not on the whole order. */
function withCycleAmount(context: RuleContext): RuleContext {
    const { purchase } = context;
    if (!purchase?.subscription) return context;
    return {
        ...context,
        purchase: { ...purchase, amount: purchase.subscription.cycleAmount },
    };
}

/** Only the first step of a plan counts toward the per-user caps. */
function countsTowardCaps(reward: CalculatedReward): boolean {
    return reward.planStep === undefined || reward.planStep === 1;
}

function collectScopeMiss(
    result: SingleCampaignResult,
    campaignId: string,
    into: string[]
): void {
    if (result.scopeMatchedNoItem) {
        into.push(campaignId);
    }
}

function campaignResult(
    overrides: Partial<SingleCampaignResult> = {}
): SingleCampaignResult {
    return {
        matched: false,
        rewards: [],
        budgetExceeded: false,
        errors: [],
        deferForUnpriceableReward: false,
        scopeMatchedNoItem: false,
        ...overrides,
    };
}

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
                scopeMatchedNoItemCampaigns: [],
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
        const scopeMatchedNoItemCampaigns: string[] = [];
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

            collectScopeMiss(result, campaign.id, scopeMatchedNoItemCampaigns);
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
                    (reward) =>
                        reward.recipient === "referee" &&
                        countsTowardCaps(reward)
                ).length;
            }
        }

        return {
            rewards: allRewards,
            budgetExceeded,
            skippedCampaigns,
            scopeMatchedNoItemCampaigns,
            errors,
            deferForUnpriceableReward,
            deferReason,
        };
    }

    // Evaluated with each item as the root object (`field: "productId"`, not
    // `field: "purchase.items.productId"`).
    private applyProductScope(
        productScope: RuleConditions | undefined,
        context: RuleContext
    ): ProductScopeOutcome {
        if (!productScope) return { context };

        const { purchase } = context;
        if (!purchase) return { context: undefined, reason: "no_purchase" };

        const matchedItems = purchase.items.filter((item) =>
            this.conditionEvaluator.evaluate(productScope, item)
        );
        if (matchedItems.length === 0) {
            return { context: undefined, reason: "scope_matched_no_item" };
        }

        return {
            context: {
                ...context,
                purchase: {
                    ...purchase,
                    matchedAmount: roundAmount(
                        matchedItems.reduce(
                            (sum, item) => sum + item.totalPrice,
                            0
                        )
                    ),
                    matchedQuantity: matchedItems.reduce(
                        (sum, item) => sum + item.quantity,
                        0
                    ),
                },
            },
        };
    }

    /** The merchant-wide cap spans every campaign, the per-campaign one only when set. */
    private isCapReached(
        campaign: CampaignRuleSelect,
        context: RuleContext,
        merchantRewardCount: number | undefined,
        campaignRefereeCounts: Map<string, number> | undefined
    ): boolean {
        const { merchantMaxRewardsPerUser, maxRewardsPerUser } = campaign.rule;
        const identityGroupId = context.user.identityGroupId;

        if (
            merchantMaxRewardsPerUser !== undefined &&
            merchantRewardCount !== undefined &&
            merchantRewardCount >= merchantMaxRewardsPerUser
        ) {
            log.debug(
                {
                    campaignId: campaign.id,
                    identityGroupId,
                    merchantRewardCount,
                    merchantMaxRewardsPerUser,
                },
                "Merchant-wide per-user reward cap reached"
            );
            return true;
        }

        const userRewardCount = campaignRefereeCounts?.get(campaign.id) ?? 0;
        if (
            maxRewardsPerUser !== undefined &&
            userRewardCount >= maxRewardsPerUser
        ) {
            log.debug(
                {
                    campaignId: campaign.id,
                    identityGroupId,
                    userRewardCount,
                    maxPerUser: maxRewardsPerUser,
                },
                "Per-campaign per-user reward cap reached"
            );
            return true;
        }
        return false;
    }

    /** A subscription campaign prices a whole plan; any other prices one payout. */
    private priceRewards(
        campaign: CampaignRuleSelect,
        context: RuleContext,
        referralChain: ReferralChainMember[] | undefined,
        merchantDefaultToken: Address | undefined
    ) {
        const { rule } = campaign;
        if (rule.subscription) {
            return this.rewardCalculator.calculatePlan({
                rewards: rule.rewards,
                context: withCycleAmount(context),
                campaignRuleId: campaign.id,
                inactivityDays:
                    rule.subscription.inactivityDays ??
                    DEFAULT_SUBSCRIPTION_INACTIVITY_DAYS,
                subscription: rule.subscription,
                merchantDefaultToken,
            });
        }
        return this.rewardCalculator.calculateAll(
            rule.rewards,
            context,
            campaign.id,
            referralChain,
            rule.pendingRewardExpirationDays,
            rule.defaultLockupSeconds,
            merchantDefaultToken
        );
    }

    private async evaluateSingleCampaign(
        campaign: CampaignRuleSelect,
        context: RuleContext,
        merchantId: string,
        merchantRewardCount: number | undefined,
        campaignRefereeCounts: Map<string, number> | undefined,
        fetchReferralChain?: ReferralChainFetcher,
        merchantDefaultToken?: Address
    ): Promise<SingleCampaignResult> {
        // A subscription campaign only ever pays on a counted subscription checkout.
        if (campaign.rule.subscription && !context.purchase?.subscription) {
            return campaignResult();
        }

        const conditionsMatch = this.conditionEvaluator.evaluate(
            campaign.rule.conditions,
            context
        );

        if (!conditionsMatch) {
            return campaignResult();
        }

        // A scoped campaign without purchase items never matches — this also
        // covers non-purchase triggers, which never carry items.
        const scopeOutcome = this.applyProductScope(
            campaign.rule.productScope,
            context
        );
        const scopedContext = scopeOutcome.context;
        if (!scopedContext) {
            if (scopeOutcome.reason === "scope_matched_no_item") {
                log.debug(
                    {
                        campaignId: campaign.id,
                        identityGroupId: context.user.identityGroupId,
                        orderId: context.purchase?.orderId,
                        itemCount: context.purchase?.items.length ?? 0,
                        productScope: campaign.rule.productScope,
                    },
                    "Product scope matched no line item"
                );
                return campaignResult({ scopeMatchedNoItem: true });
            }
            return campaignResult();
        }

        if (
            this.isCapReached(
                campaign,
                context,
                merchantRewardCount,
                campaignRefereeCounts
            )
        ) {
            return campaignResult({ matched: true });
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
            await this.priceRewards(
                campaign,
                scopedContext,
                referralChain,
                merchantDefaultToken
            );

        // Unpriceable reward: bail before consuming budget so the
        // orchestrator can leave the interaction unprocessed for a later retry.
        if (deferForUnpriceableReward) {
            return campaignResult({
                matched: true,
                errors,
                deferForUnpriceableReward: true,
                deferReason,
            });
        }

        if (calculated.length === 0) {
            return campaignResult({ matched: true, errors });
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
            return campaignResult({
                matched: true,
                budgetExceeded: true,
                errors,
            });
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

        return campaignResult({
            matched: true,
            rewards: holdIfRequired(campaign, calculated),
            errors,
        });
    }
}
