import type {
    BudgetConfigItem,
    CampaignGoal,
    CampaignTrigger,
    RewardChaining,
    RewardRecipient,
    SpecialCategory,
} from "@/types/Campaign";

export type CampaignFormValues = {
    name: string;
    merchantId: string;
    goal: CampaignGoal | undefined;
    specialCategories: SpecialCategory[];
    territories: string[];
    budget: BudgetConfigItem | undefined;
    scheduled: {
        dateStart: Date;
        dateEnd?: Date;
    };
    trigger: CampaignTrigger;
    rewardAmount: number;
    rewardRecipient: RewardRecipient;
    rewardChaining?: RewardChaining;
    priority: number;
};
