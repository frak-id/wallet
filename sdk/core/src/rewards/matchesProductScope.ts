import type {
    ConditionGroup,
    ProductDetails,
    RuleCondition,
    RuleConditions,
} from "../types";
import { SCALAR_OPERATORS, STRING_OPERATORS } from "./operators";

function isConditionGroup(
    condition: RuleCondition | ConditionGroup
): condition is ConditionGroup {
    return "logic" in condition && "conditions" in condition;
}

function getField(
    product: ProductDetails,
    field: string
): string | number | undefined {
    return product[field as keyof ProductDetails];
}

// Numeric thresholds are routinely authored as JSON strings (`"79.90"`), and
// product fields arrive as strings too (HTML attributes, query params).
function asNumber(value: string | number | boolean): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

// Mirrors the backend's `compareValues`: numeric whenever both sides are
// numeric, lexicographic only for genuine text. A `String()` fallback would
// rank "9" above "10".
function compare(a: string | number, b: string | number | boolean): number {
    const numA = asNumber(a);
    const numB = asNumber(b);
    if (numA !== undefined && numB !== undefined) return numA - numB;
    return String(a).localeCompare(String(b));
}

function evaluateArrayOperator(
    operator: "in" | "not_in",
    fieldValue: string | number | undefined,
    value: RuleCondition["value"]
): boolean | undefined {
    if (!Array.isArray(value)) return operator === "not_in";
    // Deliberate divergence from the backend, which hard-fails here: a missing
    // field client-side only means the integrator didn't supply it.
    if (fieldValue === undefined) return undefined;
    const includes = value.includes(fieldValue);
    return operator === "in" ? includes : !includes;
}

function evaluateComparisonOperator(
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between",
    fieldValue: string | number,
    value: string | number | boolean,
    valueTo: RuleCondition["valueTo"]
): boolean | undefined {
    switch (operator) {
        case "eq":
            return fieldValue === value;
        case "neq":
            return fieldValue !== value;
        case "gt":
            return compare(fieldValue, value) > 0;
        case "gte":
            return compare(fieldValue, value) >= 0;
        case "lt":
            return compare(fieldValue, value) < 0;
        case "lte":
            return compare(fieldValue, value) <= 0;
        case "between":
            if (
                valueTo === null ||
                valueTo === undefined ||
                Array.isArray(valueTo)
            ) {
                return undefined;
            }
            return (
                compare(fieldValue, value) >= 0 &&
                compare(fieldValue, valueTo) <= 0
            );
    }
}

function evaluateStringOperator(
    operator: "contains" | "starts_with" | "ends_with",
    fieldValue: string | number,
    value: string | number | boolean
): boolean | undefined {
    if (typeof fieldValue !== "string" || typeof value !== "string") {
        return undefined;
    }
    if (operator === "contains") return fieldValue.includes(value);
    if (operator === "starts_with") return fieldValue.startsWith(value);
    return fieldValue.endsWith(value);
}

/**
 * Returns `undefined` when the condition cannot be meaningfully evaluated
 * client-side (unknown operator, malformed operand). Callers fail OPEN on it.
 */
function evaluateCondition(
    condition: RuleCondition,
    product: ProductDetails
): boolean | undefined {
    const fieldValue = getField(product, condition.field);
    const { operator, value, valueTo } = condition;

    if (operator === "exists") return fieldValue !== undefined;
    if (operator === "not_exists") return fieldValue === undefined;

    if (operator === "in" || operator === "not_in") {
        return evaluateArrayOperator(operator, fieldValue, value);
    }

    // Remaining operators are scalar-only. The backend fails closed on an array
    // operand here; advisory display fails open instead.
    if (Array.isArray(value) || fieldValue === undefined || value === null) {
        return undefined;
    }

    if (SCALAR_OPERATORS.has(operator)) {
        return evaluateComparisonOperator(
            operator as "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between",
            fieldValue,
            value,
            valueTo
        );
    }
    if (STRING_OPERATORS.has(operator)) {
        return evaluateStringOperator(
            operator as "contains" | "starts_with" | "ends_with",
            fieldValue,
            value
        );
    }

    // Unknown operator: non-evaluable, fail open.
    return undefined;
}

/**
 * Evaluate a condition or group, failing open (`true`) for any non-evaluable
 * leaf. `all`/`any`/`none` then combine the failed-open booleans normally.
 */
function evaluateNode(
    node: RuleCondition | ConditionGroup,
    product: ProductDetails
): boolean {
    if (isConditionGroup(node)) {
        const results = node.conditions.map((child) =>
            evaluateNode(child, product)
        );
        if (node.logic === "all") return results.every(Boolean);
        if (node.logic === "any") return results.some(Boolean);
        if (node.logic === "none") return !results.some(Boolean);
        return true;
    }
    const result = evaluateCondition(node, product);
    return result ?? true;
}

/**
 * Advisory client-side check of whether `product` matches a campaign's
 * `productScope`.
 *
 * **Display hint, not an eligibility check.** The backend's
 * `RuleConditionEvaluator` remains the sole authority on what actually earns a
 * reward. This fails OPEN: anything it can't confidently evaluate counts as a
 * match, so it can never hide a reward the backend would pay.
 *
 * @param scope - A campaign's `productScope`; `undefined` matches everything.
 * @param product - The product currently on display.
 */
export function matchesProductScope(
    scope: RuleConditions | undefined,
    product: ProductDetails
): boolean {
    if (!scope) return true;
    if (Array.isArray(scope)) {
        return scope.every((condition) => evaluateNode(condition, product));
    }
    return evaluateNode(scope, product);
}
