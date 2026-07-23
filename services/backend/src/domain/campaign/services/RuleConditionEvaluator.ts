import type {
    ConditionGroup,
    ConditionOperator,
    RuleCondition,
    RuleContext,
} from "../types";

// Conditions are evaluated against either the full RuleContext (order-level
// `conditions`) or a single purchase item (`productScope`) — both are plain
// objects walked by the same dot-path logic, so the shared internals accept
// `unknown` rather than binding to RuleContext's shape.

type ConditionOrGroup = RuleCondition | ConditionGroup;

export function isConditionGroup(
    condition: ConditionOrGroup
): condition is ConditionGroup {
    return "logic" in condition && "conditions" in condition;
}

function getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== "object") {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }

    return current;
}

function compareValues(a: unknown, b: unknown): number {
    if (typeof a === "number" && typeof b === "number") {
        return a - b;
    }
    if (typeof a === "string" && typeof b === "string") {
        return a.localeCompare(b);
    }
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() - b.getTime();
    }
    return String(a).localeCompare(String(b));
}

function evaluateComparison(
    operator: "gt" | "gte" | "lt" | "lte",
    fieldValue: unknown,
    conditionValue: unknown
): boolean {
    const cmp = compareValues(fieldValue, conditionValue);
    if (operator === "gt") return cmp > 0;
    if (operator === "gte") return cmp >= 0;
    if (operator === "lt") return cmp < 0;
    return cmp <= 0;
}

function evaluateStringOperator(
    operator: "contains" | "starts_with" | "ends_with",
    fieldValue: unknown,
    conditionValue: unknown
): boolean {
    if (typeof fieldValue !== "string" || typeof conditionValue !== "string") {
        return false;
    }
    if (operator === "contains") return fieldValue.includes(conditionValue);
    if (operator === "starts_with")
        return fieldValue.startsWith(conditionValue);
    return fieldValue.endsWith(conditionValue);
}

function evaluateArrayOperator(
    operator: "in" | "not_in",
    fieldValue: unknown,
    conditionValue: unknown
): boolean {
    if (!Array.isArray(conditionValue)) {
        return operator === "not_in";
    }
    const includes = conditionValue.includes(fieldValue);
    return operator === "in" ? includes : !includes;
}

// Arrays are only ever a valid operand for `in`/`not_in`. Order-level
// `conditions` are not field-allowlisted like `productScope` is, and
// `RuleConditionValue` accepts arrays, so a scalar/string/comparison operator
// can receive one (a malformed rule-builder payload, a hand-crafted API call).
// Silently letting it through would misbehave two different ways depending on
// operator: `eq`/`neq` do a strict `===`/`!==` against an array, which is
// always false/true; `gt`/`gte`/`lt`/`lte`/`between` fall through
// `compareValues`'s `String()` coercion into a meaningless lexicographic
// compare. Fail closed instead: any of these operators seeing an array
// operand (in either `value` or `valueTo`) simply never matches.
const ARRAY_INVALID_OPERATORS = new Set([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
    "contains",
    "starts_with",
    "ends_with",
]);

function hasInvalidArrayOperand(
    operator: ConditionOperator,
    conditionValue: unknown,
    conditionValueTo: unknown
): boolean {
    return (
        ARRAY_INVALID_OPERATORS.has(operator) &&
        (Array.isArray(conditionValue) || Array.isArray(conditionValueTo))
    );
}

function evaluateOperator(
    operator: ConditionOperator,
    fieldValue: unknown,
    conditionValue: unknown,
    conditionValueTo?: unknown
): boolean {
    if (operator === "eq") return fieldValue === conditionValue;
    if (operator === "neq") return fieldValue !== conditionValue;
    if (operator === "exists")
        return fieldValue !== undefined && fieldValue !== null;
    if (operator === "not_exists")
        return fieldValue === undefined || fieldValue === null;

    if (operator === "between") {
        if (conditionValueTo === undefined) return false;
        return (
            compareValues(fieldValue, conditionValue) >= 0 &&
            compareValues(fieldValue, conditionValueTo) <= 0
        );
    }

    if (
        operator === "gt" ||
        operator === "gte" ||
        operator === "lt" ||
        operator === "lte"
    ) {
        return evaluateComparison(operator, fieldValue, conditionValue);
    }

    if (operator === "in" || operator === "not_in") {
        return evaluateArrayOperator(operator, fieldValue, conditionValue);
    }

    if (
        operator === "contains" ||
        operator === "starts_with" ||
        operator === "ends_with"
    ) {
        return evaluateStringOperator(operator, fieldValue, conditionValue);
    }

    return false;
}

function evaluateSingleCondition(
    condition: RuleCondition,
    target: unknown
): boolean {
    if (
        hasInvalidArrayOperand(
            condition.operator,
            condition.value,
            condition.valueTo
        )
    ) {
        return false;
    }

    const fieldValue = getNestedValue(target, condition.field);
    return evaluateOperator(
        condition.operator,
        fieldValue,
        condition.value,
        condition.valueTo
    );
}

function evaluateConditionGroup(
    group: ConditionGroup,
    target: unknown
): boolean {
    const results = group.conditions.map((c) =>
        isConditionGroup(c)
            ? evaluateConditionGroup(c, target)
            : evaluateSingleCondition(c, target)
    );

    if (group.logic === "all") return results.every(Boolean);
    if (group.logic === "any") return results.some(Boolean);
    if (group.logic === "none") return !results.some(Boolean);
    return false;
}

export class RuleConditionEvaluator {
    /**
     * Evaluate a condition set against an arbitrary target object — the full
     * `RuleContext` for order-level `conditions`, or a single purchase item
     * for `productScope`.
     */
    evaluateAgainst(
        conditions: RuleCondition[] | ConditionGroup,
        target: unknown
    ): boolean {
        if (Array.isArray(conditions)) {
            return conditions.every((c) => evaluateSingleCondition(c, target));
        }
        return evaluateConditionGroup(conditions, target);
    }

    evaluate(
        conditions: RuleCondition[] | ConditionGroup,
        context: RuleContext
    ): boolean {
        return this.evaluateAgainst(conditions, context);
    }

    getFieldValue(context: RuleContext, field: string): unknown {
        return getNestedValue(context, field);
    }
}
