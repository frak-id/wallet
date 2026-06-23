import type {
    ConditionGroup,
    RuleCondition,
    RuleConditions,
} from "@frak-labs/backend-elysia/domain/campaign";

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
