import type {
    ConditionGroup,
    EstimatedRewardItem,
    RuleCondition,
    RuleConditions,
} from "@frak-labs/backend-elysia/domain/campaign";
import type { EstimatedReward } from "@frak-labs/core-sdk";

const SECONDS_PER_DAY = 86400;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ---------------------------------------------------------------------------
// Rule-condition extraction
// ---------------------------------------------------------------------------

type ConditionNode = RuleCondition | ConditionGroup;

function conditionNodes(conditions: RuleConditions): ConditionNode[] {
    return Array.isArray(conditions) ? conditions : conditions.conditions;
}

function conditionValueToNumber(
    value: RuleCondition["value"]
): number | undefined {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

// Conditions arrive as a flat list or recursive groups; collect every numeric
// value whose field + operator match, descending into nested groups.
function collectConditionValues(
    conditions: RuleConditions,
    field: string,
    operators: ReadonlySet<RuleCondition["operator"]>
): number[] {
    const values: number[] = [];
    for (const node of conditionNodes(conditions)) {
        if ("logic" in node) {
            values.push(...collectConditionValues(node, field, operators));
            continue;
        }
        if (node.field === field && operators.has(node.operator)) {
            const value = conditionValueToNumber(node.value);
            if (value != null) values.push(value);
        }
    }
    return values;
}

const MIN_PURCHASE_OPERATORS: ReadonlySet<RuleCondition["operator"]> = new Set([
    "gt",
    "gte",
    "between",
]);
const START_DATE_OPERATORS: ReadonlySet<RuleCondition["operator"]> = new Set([
    "gt",
    "gte",
]);

export function extractMinPurchaseAmount(
    conditions: RuleConditions
): number | undefined {
    const values = collectConditionValues(
        conditions,
        "purchase.amount",
        MIN_PURCHASE_OPERATORS
    );
    return values.length > 0 ? Math.min(...values) : undefined;
}

// The business app encodes a campaign start as a `time.timestamp >= <unix s>`
// rule condition; the endpoint returns it verbatim inside `conditions`.
export function extractStartDate(conditions: RuleConditions): Date | undefined {
    const values = collectConditionValues(
        conditions,
        "time.timestamp",
        START_DATE_OPERATORS
    );
    if (values.length === 0) return undefined;
    return new Date(Math.min(...values) * 1000);
}

// ---------------------------------------------------------------------------
// Campaign selection
// ---------------------------------------------------------------------------

export function getRewardEurValue(reward: EstimatedReward): number {
    switch (reward.payoutType) {
        case "fixed":
            return reward.amount.eurAmount;
        case "percentage":
            return reward.maxAmount?.eurAmount ?? 0;
        case "tiered":
            return reward.tiers.reduce(
                (max, tier) =>
                    "amount" in tier
                        ? Math.max(max, tier.amount.eurAmount)
                        : max,
                0
            );
    }
}

function campaignRewardValue(campaign: EstimatedRewardItem): number {
    const referrer = campaign.referrer
        ? getRewardEurValue(campaign.referrer)
        : 0;
    const referee = campaign.referee ? getRewardEurValue(campaign.referee) : 0;
    return Math.max(referrer, referee);
}

export type DisplayCampaign = {
    campaign: EstimatedRewardItem;
    status: "live" | "upcoming";
    startsAt?: Date;
};

function isExpired(campaign: EstimatedRewardItem, nowMs: number): boolean {
    return (
        campaign.expiresAt != null &&
        new Date(campaign.expiresAt).getTime() <= nowMs
    );
}

function hasStarted(campaign: EstimatedRewardItem, nowMs: number): boolean {
    const startsAt = extractStartDate(campaign.conditions);
    return startsAt == null || startsAt.getTime() <= nowMs;
}

// The endpoint does not gate on the start-date condition, so future-start
// campaigns come through: prefer the richest started one, else the soonest.
export function selectDisplayCampaign(
    rewards: EstimatedRewardItem[],
    now: Date = new Date()
): DisplayCampaign | undefined {
    const nowMs = now.getTime();
    const active = rewards.filter((campaign) => !isExpired(campaign, nowMs));

    const live = active.filter((campaign) => hasStarted(campaign, nowMs));
    if (live.length > 0) {
        const best = live.reduce((a, b) =>
            campaignRewardValue(b) > campaignRewardValue(a) ? b : a
        );
        return { campaign: best, status: "live" };
    }

    const upcoming = active
        .map((campaign) => ({
            campaign,
            startsAt: extractStartDate(campaign.conditions),
        }))
        .filter(
            (
                entry
            ): entry is { campaign: EstimatedRewardItem; startsAt: Date } =>
                entry.startsAt != null
        );
    if (upcoming.length === 0) return undefined;

    const soonest = upcoming.reduce((a, b) =>
        b.startsAt.getTime() < a.startsAt.getTime() ? b : a
    );
    return {
        campaign: soonest.campaign,
        status: "upcoming",
        startsAt: soonest.startsAt,
    };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function formatDate(date: Date, locale: string): string {
    return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function getDaysRemaining(end: Date, now: Date): number | null {
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    return Math.ceil(diffMs / MS_PER_DAY);
}

export function lockupSecondsToDays(
    seconds: number | undefined
): number | undefined {
    return seconds != null ? Math.floor(seconds / SECONDS_PER_DAY) : undefined;
}
