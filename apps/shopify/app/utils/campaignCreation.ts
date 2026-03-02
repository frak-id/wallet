import type {
    CampaignRuleDefinition,
    FixedRewardDefinition,
} from "@frak-labs/backend-elysia/domain/campaign";
import type { Hex } from "viem";

const FRAK_COMMISSION_PERCENT = 20;
const DEFAULT_DEPERDITION_PER_LEVEL = 80;
const DEFAULT_MAX_DEPTH = 5;

/**
 * Build a campaign rule definition from CAC and referrer/referee ratio.
 * Ported from business app embedded creation flow.
 *
 * The CAC is first reduced by the Frak commission (20%), then the
 * remaining amount is split between referrer and referee according
 * to the given ratio.  The referrer reward includes a default chaining
 * configuration so rewards propagate along the referral chain.
 */
export function buildCampaignRule({
    cacBrut,
    ratio,
    rewardToken,
}: {
    cacBrut: number;
    ratio: number;
    rewardToken?: string;
}): CampaignRuleDefinition {
    const frakCommission =
        Math.round(cacBrut * (FRAK_COMMISSION_PERCENT / 100) * 100) / 100;
    const distributableAmount = cacBrut - frakCommission;

    const referrerPercent = ratio / 100;
    const refereePercent = 1 - referrerPercent;

    const rewards: FixedRewardDefinition[] = [];

    if (referrerPercent > 0) {
        rewards.push({
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount:
                Math.round(distributableAmount * referrerPercent * 100) / 100,
            token: rewardToken as Hex | undefined,
            description: "Referrer reward",
            chaining: {
                deperditionPerLevel: DEFAULT_DEPERDITION_PER_LEVEL,
                maxDepth: DEFAULT_MAX_DEPTH,
            },
        });
    }

    if (refereePercent > 0) {
        rewards.push({
            recipient: "referee",
            type: "token",
            amountType: "fixed",
            amount:
                Math.round(distributableAmount * refereePercent * 100) / 100,
            token: rewardToken as Hex | undefined,
            description: "Referee reward",
        });
    }

    return {
        trigger: "purchase",
        conditions: [
            {
                field: "attribution.referrerIdentityGroupId",
                operator: "exists" as const,
                value: true,
            },
        ],
        rewards,
        maxRewardsPerUser: 1,
    };
}
