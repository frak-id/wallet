import type { Hex } from "viem";
import type {
    MigrationAction,
    V1MongoDBCampaign,
    V2CampaignRuleInsert,
} from "../types";

const V1_TO_V2_TRIGGER_MAP: Record<
    string,
    "purchase" | "referral_link" | "create_referral_link"
> = {
    "purchase.completed": "purchase",
    "purchase.started": "purchase",
    referred: "referral_link",
    createLink: "create_referral_link",
    "webshop.opened": "purchase",
    "article.read": "referral_link",
    "article.open": "referral_link",
};

function mapV1TriggerToV2(
    triggerKey: string
): "purchase" | "referral_link" | "create_referral_link" {
    return V1_TO_V2_TRIGGER_MAP[triggerKey] ?? "purchase";
}

function mapV1BudgetToV2(
    budget: V1MongoDBCampaign["budget"]
): V2CampaignRuleInsert["budgetConfig"] {
    if (!budget.type || budget.maxEuroDaily <= 0) return undefined;

    const durationMap: Record<string, number | null> = {
        daily: 24 * 60 * 60,
        weekly: 7 * 24 * 60 * 60,
        monthly: 30 * 24 * 60 * 60,
        global: null,
    };

    return [
        {
            label: budget.type,
            durationInSeconds: durationMap[budget.type] ?? null,
            amount: budget.maxEuroDaily,
        },
    ];
}

function createRewardFromTrigger(
    triggerConfig:
        | { cac: number; maxCountPerUser?: number }
        | { from: number; to: number; maxCountPerUser?: number },
    chaining?: { deperditionPerLevel: number; maxDepth?: number },
    defaultToken?: Hex
): unknown {
    const amount =
        "cac" in triggerConfig
            ? triggerConfig.cac
            : (triggerConfig.from + triggerConfig.to) / 2;

    return {
        recipient: "referrer",
        type: "token",
        amountType: "fixed",
        amount,
        token: defaultToken,
        chaining,
    };
}

export function transformMongoDBCampaignToRules(
    campaign: V1MongoDBCampaign,
    merchantId: string,
    defaultToken?: Hex
): { rules: V2CampaignRuleInsert[]; actions: MigrationAction[] } {
    const rules: V2CampaignRuleInsert[] = [];
    const actions: MigrationAction[] = [];

    const metadata: NonNullable<V2CampaignRuleInsert["metadata"]> = {};
    if (campaign.type)
        metadata.goal = campaign.type as NonNullable<
            V2CampaignRuleInsert["metadata"]
        >["goal"];
    if (campaign.specialCategories.length > 0)
        metadata.specialCategories = campaign.specialCategories;
    if (campaign.territories.length > 0)
        metadata.territories = campaign.territories;

    const budgetConfig = mapV1BudgetToV2(campaign.budget);
    const chaining = campaign.rewardChaining?.deperditionPerLevel
        ? {
              deperditionPerLevel:
                  campaign.rewardChaining.deperditionPerLevel / 10000,
              maxDepth: 5,
          }
        : undefined;

    const status =
        campaign.state.key === "created"
            ? "active"
            : campaign.state.key === "creationFailed"
              ? "archived"
              : "draft";

    let priority = 0;
    for (const [triggerKey, triggerConfig] of Object.entries(
        campaign.triggers
    )) {
        const v2Trigger = mapV1TriggerToV2(triggerKey);
        const reward = createRewardFromTrigger(
            triggerConfig,
            chaining,
            defaultToken
        );

        const rule: V2CampaignRuleInsert = {
            merchantId,
            name: `${campaign.title} - ${triggerKey}`,
            status,
            priority: priority++,
            rule: { trigger: v2Trigger, conditions: [], rewards: [reward] },
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            budgetConfig,
            expiresAt: campaign.scheduled?.dateEnd,
            publishedAt:
                status === "active" ? campaign.scheduled?.dateStart : undefined,
        };

        rules.push(rule);
        actions.push({ type: "create_campaign_rule", data: rule });
    }

    return { rules, actions };
}

export function formatCampaignRuleForDryRun(
    rule: V2CampaignRuleInsert
): string {
    return `
  Campaign Rule:
    - Name: ${rule.name}
    - Merchant ID: ${rule.merchantId}
    - Status: ${rule.status}
    - Trigger: ${rule.rule.trigger}
    - Budget: ${rule.budgetConfig ? JSON.stringify(rule.budgetConfig) : "None"}
`;
}
