import type {
    ConditionGroup,
    ConditionOperator,
    PurchaseItem,
    RuleCondition,
    RuleContext,
} from "../types";

// Conditions are evaluated against either the full RuleContext (order-level
// `conditions`) or a single purchase item (`productScope`), both walked by
// the same dot-path logic.
type EvaluationTarget = RuleContext | PurchaseItem;

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

// Arrays are only a valid operand for `in`/`not_in`. Comparison operators
// would otherwise `String()`-coerce an array into a meaningless lexicographic
// compare (and `neq` would be always-true), so fail closed: never match.
// String operators already fail closed on non-string operands.
const ARRAY_INVALID_OPERATORS = new Set([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
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
    target: EvaluationTarget
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
    target: EvaluationTarget
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
     * Evaluate a condition set against the full `RuleContext` (order-level
     * `conditions`) or a single purchase item (`productScope`).
     */
    evaluate(
        conditions: RuleCondition[] | ConditionGroup,
        target: EvaluationTarget
    ): boolean {
        if (Array.isArray(conditions)) {
            return conditions.every((c) => evaluateSingleCondition(c, target));
        }
        return evaluateConditionGroup(conditions, target);
    }

    getFieldValue(context: RuleContext, field: string): unknown {
        return getNestedValue(context, field);
    }
}
