import { log } from "@backend-infrastructure";
import type { CampaignRuleSelect } from "../db/schema";
import { CampaignRuleRepository } from "../repositories/CampaignRuleRepository";
import type {
    CalculatedReward,
    CampaignTrigger,
    EvaluationResult,
    RuleContext,
    TimeContext,
} from "../types";
import { RewardCalculator } from "./RewardCalculator";
import { RuleConditionEvaluator } from "./RuleConditionEvaluator";

type EvaluateRulesParams = {
    merchantId: string;
    trigger: CampaignTrigger;
    context: Omit<RuleContext, "time">;
    referrerIdentityGroupId?: string;
};

function buildTimeContext(): TimeContext {
    const now = new Date();
    return {
        dayOfWeek: now.getUTCDay(),
        hourOfDay: now.getUTCHours(),
        date: now.toISOString().split("T")[0],
        timestamp: Math.floor(now.getTime() / 1000),
    };
}

export class RuleEngineService {
    private readonly repository: CampaignRuleRepository;
    private readonly conditionEvaluator: RuleConditionEvaluator;
    private readonly rewardCalculator: RewardCalculator;

    constructor(
        repository?: CampaignRuleRepository,
        conditionEvaluator?: RuleConditionEvaluator,
        rewardCalculator?: RewardCalculator
    ) {
        this.repository = repository ?? new CampaignRuleRepository();
        this.conditionEvaluator =
            conditionEvaluator ?? new RuleConditionEvaluator();
        this.rewardCalculator =
            rewardCalculator ?? new RewardCalculator(this.conditionEvaluator);
    }

    async evaluateRules(
        params: EvaluateRulesParams
    ): Promise<EvaluationResult> {
        const fullContext: RuleContext = {
            ...params.context,
            time: buildTimeContext(),
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
                params.referrerIdentityGroupId
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
        referrerIdentityGroupId?: string
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

        const { calculated, errors } = this.rewardCalculator.calculateAll(
            campaign.rule.rewards,
            context,
            campaign.id,
            referrerIdentityGroupId
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
