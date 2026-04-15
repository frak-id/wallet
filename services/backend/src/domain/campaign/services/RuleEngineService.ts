import { log } from "@backend-infrastructure";
import type { AssetLogRepository } from "../../rewards/repositories/AssetLogRepository";
import type { CampaignRuleSelect } from "../db/schema";
import type { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type {
    CalculatedReward,
    CampaignTrigger,
    EvaluationResult,
    ReferralChainFetcher,
    ReferralChainMember,
    RuleContext,
    TimeContext,
} from "../types";
import type { RewardCalculator } from "./RewardCalculator";
import type { RuleConditionEvaluator } from "./RuleConditionEvaluator";

type EvaluateRulesParams = {
    merchantId: string;
    trigger: CampaignTrigger;
    context: Omit<RuleContext, "time">;
    time?: TimeContext;
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

        const allRewards: CalculatedReward[] = [];
        const skippedCampaigns: string[] = [];
        const errors: { campaignRuleId: string; error: string }[] = [];
        let budgetExceeded = false;

        for (const campaign of activeCampaigns) {
            const result = await this.evaluateSingleCampaign(
                campaign,
                fullContext,
                params.merchantId,
                merchantRewardCount,
                fetchReferralChain
            );

            if (!result.matched) continue;

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
        }

        return {
            rewards: allRewards,
            budgetExceeded,
            skippedCampaigns,
            errors,
        };
    }

    private async evaluateSingleCampaign(
        campaign: CampaignRuleSelect,
        context: RuleContext,
        merchantId: string,
        merchantRewardCount: number | undefined,
        fetchReferralChain?: ReferralChainFetcher
    ): Promise<{
        matched: boolean;
        rewards: CalculatedReward[];
        budgetExceeded: boolean;
        errors: string[];
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
            };
        }

        // Check per-campaign per-user cap (only if explicitly set)
        if (campaign.rule.maxRewardsPerUser !== undefined) {
            const userRewardCount =
                await this.assetLogRepository.countByCampaignAndUserAsReferee(
                    campaign.id,
                    context.user.identityGroupId
                );

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

        const { calculated, errors } = this.rewardCalculator.calculateAll(
            campaign.rule.rewards,
            context,
            campaign.id,
            referralChain,
            campaign.rule.pendingRewardExpirationDays
        );

        if (calculated.length === 0) {
            return {
                matched: true,
                rewards: [],
                budgetExceeded: false,
                errors,
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
            return { matched: true, rewards: [], budgetExceeded: true, errors };
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
        };
    }
}
