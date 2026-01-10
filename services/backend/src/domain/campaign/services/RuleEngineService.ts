import { log } from "@backend-infrastructure";
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
        private readonly rewardCalculator: RewardCalculator
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

        const allRewards: CalculatedReward[] = [];
        const skippedCampaigns: string[] = [];
        const errors: Array<{ campaignRuleId: string; error: string }> = [];
        let budgetExceeded = false;

        for (const campaign of activeCampaigns) {
            const result = await this.evaluateSingleCampaign(
                campaign,
                fullContext,
                params.merchantId,
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
            referralChain
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

    async rollbackRewards(rewards: CalculatedReward[]): Promise<void> {
        const amountsByCampaign = new Map<string, number>();

        for (const reward of rewards) {
            const current = amountsByCampaign.get(reward.campaignRuleId) ?? 0;
            amountsByCampaign.set(
                reward.campaignRuleId,
                current + reward.amount
            );
        }

        for (const [campaignId, amount] of amountsByCampaign) {
            await this.repository.rollbackBudget(campaignId, amount);
            log.debug(
                { campaignId, amount },
                "Rolled back budget for campaign"
            );
        }
    }

    async getActiveCampaigns(
        merchantId: string,
        trigger?: CampaignTrigger
    ): Promise<CampaignRuleSelect[]> {
        return this.repository.findActiveByMerchant(merchantId, trigger);
    }

    async getCampaignBudgetStatus(campaignRuleId: string): Promise<{
        budgets: Record<
            string,
            { used: number; limit: number; remaining: number; resetAt?: string }
        >;
    } | null> {
        return this.repository.getBudgetStatus(campaignRuleId);
    }
}
