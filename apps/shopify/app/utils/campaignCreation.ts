import type {
    CampaignRuleDefinition,
    FixedRewardDefinition,
} from "@frak-labs/backend-elysia/domain/campaign";

/**
 * Build a campaign rule definition from CAC and referrer/referee ratio.
 * Ported from business app embedded creation flow.
 */
export function buildCampaignRule({
    cacBrut,
    ratio,
}: {
    cacBrut: number;
    ratio: number;
}): CampaignRuleDefinition {
    const referrerPercent = ratio / 100;
    const refereePercent = 1 - referrerPercent;

    const rewards: FixedRewardDefinition[] = [];

    if (referrerPercent > 0) {
        rewards.push({
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: Math.round(cacBrut * referrerPercent * 100) / 100,
            description: "Referrer reward",
        });
    }

    if (refereePercent > 0) {
        rewards.push({
            recipient: "referee",
            type: "token",
            amountType: "fixed",
            amount: Math.round(cacBrut * refereePercent * 100) / 100,
            description: "Referee reward",
        });
    }

    return {
        trigger: "purchase",
        conditions: [],
        rewards,
    };
}
