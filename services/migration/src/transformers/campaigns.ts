import type { CampaignTrigger } from "@backend/domain/campaign/schemas";
import type { FixedRewardDefinition } from "@backend/domain/campaign/types";
import type { Hex } from "viem";
import { migrationConfig } from "../config";
import { onChainChainingToDecimals } from "../sources/blockchain";
import type {
    MigrationAction,
    OnChainCampaignData,
    V1MongoDBCampaign,
    V2CampaignRuleInsert,
} from "../types";

const V1_TO_V2_TRIGGER_MAP: Record<string, CampaignTrigger> = {
    "purchase.completed": "purchase",
    "purchase.started": "custom",
    referred: "referral",
    createLink: "create_referral_link",
    "webshop.opened": "custom",
    "article.read": "custom",
    "article.open": "custom",
};

function mapV1TriggerToV2(triggerKey: string): CampaignTrigger {
    return V1_TO_V2_TRIGGER_MAP[triggerKey] ?? "custom";
}

function mapV1BudgetToV2(
    budget: V1MongoDBCampaign["budget"],
    onChainData?: OnChainCampaignData
): V2CampaignRuleInsert["budgetConfig"] {
    const budgetItems: NonNullable<V2CampaignRuleInsert["budgetConfig"]> = [];

    if (budget.type && budget.maxEuroDaily > 0) {
        const durationMap: Record<string, number | null> = {
            daily: 24 * 60 * 60,
            weekly: 7 * 24 * 60 * 60,
            monthly: 30 * 24 * 60 * 60,
            global: null,
        };

        budgetItems.push({
            label: budget.type,
            durationInSeconds: durationMap[budget.type] ?? null,
            amount: budget.maxEuroDaily,
        });
    }

    if (onChainData?.capConfig.amount && onChainData.capConfig.amount > 0n) {
        const capPeriod = Number(onChainData.capConfig.period);
        const capAmount = Number(onChainData.capConfig.amount) / 1e6;
        budgetItems.push({
            label: "on-chain-cap",
            durationInSeconds: capPeriod > 0 ? capPeriod : null,
            amount: capAmount,
        });
    }

    return budgetItems.length > 0 ? budgetItems : undefined;
}

const DEFAULT_USER_PERCENT = 0.1;
const DEFAULT_DEPERDITION_PER_LEVEL = 0.8;

function createRewardsFromTrigger(
    triggerConfig:
        | { cac: number; maxCountPerUser?: number }
        | { from: number; to: number; maxCountPerUser?: number },
    rewardChaining: V1MongoDBCampaign["rewardChaining"],
    defaultToken?: Hex,
    onChainData?: OnChainCampaignData
): FixedRewardDefinition[] {
    const totalAmount =
        "cac" in triggerConfig
            ? triggerConfig.cac
            : (triggerConfig.from + triggerConfig.to) / 2;

    const onChainChaining = onChainData?.chainingConfig
        ? onChainChainingToDecimals(onChainData.chainingConfig)
        : undefined;

    const userPercent =
        onChainChaining?.userPercent ??
        rewardChaining?.userPercent ??
        DEFAULT_USER_PERCENT;
    const deperditionPerLevel =
        onChainChaining?.deperditionPerLevel ??
        rewardChaining?.deperditionPerLevel ??
        DEFAULT_DEPERDITION_PER_LEVEL;

    const refereeAmount = totalAmount * userPercent;
    const referrerAmount = totalAmount * (1 - userPercent);

    const rewards: FixedRewardDefinition[] = [];

    if (refereeAmount > 0) {
        rewards.push({
            recipient: "referee",
            type: "token",
            amountType: "fixed",
            amount: refereeAmount,
            token: defaultToken,
        });
    }

    if (referrerAmount > 0) {
        rewards.push({
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: referrerAmount,
            token: defaultToken,
            chaining: {
                deperditionPerLevel,
                maxDepth: 5,
            },
        });
    }

    return rewards;
}

export type ProductOrigin = {
    productId: string;
    productDomain: string;
};

function mapV1StatusToV2(
    stateKey: V1MongoDBCampaign["state"]["key"],
    onChainData?: OnChainCampaignData
): V2CampaignRuleInsert["status"] {
    if (stateKey === "creationFailed") return "archived";
    if (stateKey !== "created") return "draft";

    if (onChainData && !onChainData.isRunning) return "paused";
    return "active";
}

function buildMetadata(
    campaign: V1MongoDBCampaign
): V2CampaignRuleInsert["metadata"] {
    const metadata: NonNullable<V2CampaignRuleInsert["metadata"]> = {};
    if (campaign.type)
        metadata.goal = campaign.type as NonNullable<
            V2CampaignRuleInsert["metadata"]
        >["goal"];
    if (campaign.specialCategories.length > 0)
        metadata.specialCategories = campaign.specialCategories;
    if (campaign.territories.length > 0)
        metadata.territories = campaign.territories;
    return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function buildConditions(
    v2Trigger: CampaignTrigger,
    triggerKey: string
): V2CampaignRuleInsert["rule"]["conditions"] {
    if (v2Trigger !== "custom") return [];
    return [
        {
            field: "custom.customType",
            operator: "eq" as const,
            value: triggerKey,
        },
    ];
}

function isTriggerEmpty(
    triggerConfig: V1MongoDBCampaign["triggers"][string]
): boolean {
    if ("from" in triggerConfig)
        return triggerConfig.from === 0 && triggerConfig.to === 0;
    return "cac" in triggerConfig && triggerConfig.cac === 0;
}

export function transformMongoDBCampaignToRules(
    campaign: V1MongoDBCampaign,
    merchantId: string,
    merchantDomain: string,
    defaultToken?: Hex,
    productOrigin?: ProductOrigin,
    onChainData?: OnChainCampaignData
): { rules: V2CampaignRuleInsert[]; actions: MigrationAction[] } {
    const rules: V2CampaignRuleInsert[] = [];
    const actions: MigrationAction[] = [];

    const metadata = buildMetadata(campaign);
    const budgetConfig = mapV1BudgetToV2(campaign.budget, onChainData);
    const status = mapV1StatusToV2(campaign.state.key, onChainData);
    const skippedTriggers = migrationConfig.skippedTriggerKeys;

    const activationStart = onChainData?.activationPeriod.start
        ? new Date(Number(onChainData.activationPeriod.start) * 1000)
        : campaign.scheduled?.dateStart
          ? new Date(campaign.scheduled.dateStart)
          : undefined;
    const activationEnd =
        onChainData?.activationPeriod.end &&
        onChainData.activationPeriod.end > 0n
            ? new Date(Number(onChainData.activationPeriod.end) * 1000)
            : campaign.scheduled?.dateEnd
              ? new Date(campaign.scheduled.dateEnd)
              : undefined;

    let priority = 0;
    for (const [triggerKey, triggerConfig] of Object.entries(
        campaign.triggers
    )) {
        if (skippedTriggers.includes(triggerKey)) continue;
        if (isTriggerEmpty(triggerConfig)) continue;

        const v2Trigger = mapV1TriggerToV2(triggerKey);
        const rewards = createRewardsFromTrigger(
            triggerConfig,
            campaign.rewardChaining,
            defaultToken,
            onChainData
        );

        const rule: V2CampaignRuleInsert = {
            merchantId,
            name: `${campaign.title} - ${triggerKey}`,
            status,
            priority: priority++,
            rule: {
                trigger: v2Trigger,
                conditions: buildConditions(v2Trigger, triggerKey),
                rewards,
            },
            metadata,
            budgetConfig,
            expiresAt: activationEnd,
            publishedAt:
                status === "active" || status === "paused"
                    ? activationStart
                    : undefined,
        };

        rules.push(rule);
        actions.push({
            type: "create_campaign_rule",
            data: rule,
            merchantDomain,
            productOrigin,
            onChainCampaignAddress: onChainData?.campaignAddress,
        });
    }

    return { rules, actions };
}

export function formatCampaignRuleForDryRun(
    rule: V2CampaignRuleInsert,
    productOrigin?: ProductOrigin,
    onChainData?: OnChainCampaignData
): string {
    const productLine = productOrigin
        ? `    - Product: ${productOrigin.productDomain} (${productOrigin.productId})\n`
        : "";
    const onChainLine = onChainData
        ? `    - On-chain: isRunning=${onChainData.isRunning}, type=${onChainData.campaignType} v${onChainData.campaignVersion}\n` +
          `    - On-chain name: ${onChainData.campaignName}\n` +
          (onChainData.chainingConfig
              ? `    - On-chain chaining: userPercent=${onChainData.chainingConfig.userPercent}/10000, deperdition=${onChainData.chainingConfig.deperditionPerLevel}/10000\n`
              : "")
        : "";
    return `
  Campaign Rule:
    - Name: ${rule.name}
${productLine}    - Status: ${rule.status}
    - Trigger: ${rule.rule.trigger}
    - Rewards: ${JSON.stringify(rule.rule.rewards)}
    - Budget: ${rule.budgetConfig ? JSON.stringify(rule.budgetConfig) : "None"}
${onChainLine}`;
}
