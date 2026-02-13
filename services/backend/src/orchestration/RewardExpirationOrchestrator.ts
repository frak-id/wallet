import { log } from "@backend-infrastructure";
import type { CampaignRuleRepository } from "../domain/campaign/repositories/CampaignRuleRepository";
import type { AssetLogRepository } from "../domain/rewards/repositories/AssetLogRepository";

type ExpirationResult = {
    expiredCount: number;
    budgetRestoredByCampaign: Record<string, number>;
};

export class RewardExpirationOrchestrator {
    constructor(
        private readonly assetLogRepository: AssetLogRepository,
        private readonly campaignRuleRepository: CampaignRuleRepository
    ) {}

    async expireAndRestoreBudgets(): Promise<ExpirationResult> {
        const expiredRewards =
            await this.assetLogRepository.expirePendingRewards();

        if (expiredRewards.length === 0) {
            return { expiredCount: 0, budgetRestoredByCampaign: {} };
        }

        const amountsByCampaign = new Map<string, number>();
        for (const reward of expiredRewards) {
            const current = amountsByCampaign.get(reward.campaignRuleId) ?? 0;
            amountsByCampaign.set(
                reward.campaignRuleId,
                current + Number.parseFloat(reward.amount)
            );
        }

        const budgetRestoredByCampaign: Record<string, number> = {};
        for (const [campaignRuleId, amount] of amountsByCampaign) {
            await this.campaignRuleRepository.restoreBudget(
                campaignRuleId,
                amount
            );
            budgetRestoredByCampaign[campaignRuleId] = amount;
        }

        log.info(
            {
                expiredCount: expiredRewards.length,
                campaignsAffected: amountsByCampaign.size,
                budgetRestoredByCampaign,
            },
            "Expired pending rewards and restored budgets"
        );

        return {
            expiredCount: expiredRewards.length,
            budgetRestoredByCampaign,
        };
    }
}
