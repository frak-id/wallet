import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import type { Campaign } from "@/types/Campaign";

export function mapCampaignToFormData(campaign: Campaign): CampaignFormValues {
    const formData: CampaignFormValues = {
        name: campaign.name,
        merchantId: campaign.merchantId,
        goal: campaign.metadata?.goal,
        specialCategories: campaign.metadata?.specialCategories || [],
        territories: campaign.metadata?.territories || [],
        budget: campaign.budgetConfig?.[0],
        scheduled: {
            dateStart: new Date(campaign.createdAt),
            dateEnd: campaign.expiresAt
                ? new Date(campaign.expiresAt)
                : undefined,
        },
        trigger: campaign.rule.trigger,
        rewardAmount:
            campaign.rule.rewards?.[0]?.type === "token" &&
            campaign.rule.rewards?.[0]?.amountType === "fixed"
                ? Number(campaign.rule.rewards[0].amount)
                : 0,
        rewardRecipient: campaign.rule.rewards?.[0]?.recipient || "referrer",
        priority: campaign.priority,
        rewardChaining: campaign.rule.rewards?.[0]?.chaining,
    };

    if (campaign.publishedAt) {
        formData.scheduled.dateStart = new Date(campaign.publishedAt);
    }

    return formData;
}
