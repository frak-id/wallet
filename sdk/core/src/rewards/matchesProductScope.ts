import type { ConditionGroup, RuleCondition, RuleConditions } from "../types";

/**
 * The subset of a purchase line item's fields a `productScope` can target.
 * Mirrors the backend's allowlist exactly — see `PRODUCT_SCOPE_FIELDS` in
 * `services/backend/src/domain/campaign/services/CampaignManagementService.ts`.
 * Any campaign field outside this set cannot have been published (validated
 * server-side at publish time), so it never needs handling here.
 */
export type ProductScopeTarget = {
    productId?: string;
    sku?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
};

function isConditionGroup(
    condition: RuleCondition | ConditionGroup
): condition is ConditionGroup {
    return "logic" in condition && "conditions" in condition;
}

function getField(
    product: ProductScopeTarget,
    field: string
): string | number | undefined {
    return product[field as keyof ProductScopeTarget];
}

function compare(a: string | number, b: string | number | boolean): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
}

function evaluateArrayOperator(
    operator: "in" | "not_in",
    fieldValue: string | number | undefined,
    value: RuleCondition["value"]
): boolean {
    if (!Array.isArray(value)) return operator === "not_in";
    if (fieldValue === undefined) return false;
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

const SCALAR_OPERATORS = new Set([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "between",
]);
const STRING_OPERATORS = new Set(["contains", "starts_with", "ends_with"]);

/**
 * Evaluate a single leaf condition against a product. Returns `undefined`
 * (rather than `true`/`false`) when the condition cannot be meaningfully
 * evaluated on the client — an unknown operator, or an array operand on a
 * scalar/string operator that the backend would reject at publish time (so
 * seeing one here means the SDK's operator/field list has drifted from the
 * backend's). Callers fail OPEN on `undefined` — see module doc.
 */
function evaluateCondition(
    condition: RuleCondition,
    product: ProductScopeTarget
): boolean | undefined {
    const fieldValue = getField(product, condition.field);
    const { operator, value, valueTo } = condition;

    if (operator === "exists") return fieldValue !== undefined;
    if (operator === "not_exists") return fieldValue === undefined;

    if (operator === "in" || operator === "not_in") {
        return evaluateArrayOperator(operator, fieldValue, value);
    }

    // Every remaining operator is scalar-only; an array operand here is a
    // condition the backend's evaluator would fail *closed* on (never
    // matches). Advisory display fails *open* instead: treat it as
    // non-evaluable rather than asserting a false negative.
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

    // Unknown operator (backend added one the SDK doesn't know about yet) —
    // non-evaluable, fail open.
    return undefined;
}

/**
 * Evaluate a condition or group against a product, failing open (`true`) for
 * any leaf that can't be meaningfully evaluated. A group only inherits its
 * children's non-evaluable leaves as "matches" — `all`/`any`/`none` still
 * combine the (failed-open) booleans normally, so one unknown leaf doesn't
 * silently force the whole group to match when siblings clearly don't.
 */
function evaluateNode(
    node: RuleCondition | ConditionGroup,
    product: ProductScopeTarget
): boolean {
    if (isConditionGroup(node)) {
        const results = node.conditions.map((child) =>
            evaluateNode(child, product)
        );
        if (node.logic === "all") return results.every(Boolean);
        if (node.logic === "any") return results.some(Boolean);
        if (node.logic === "none") return !results.some(Boolean);
        // Unknown group logic — fail open.
        return true;
    }
    const result = evaluateCondition(node, product);
    return result ?? true;
}

/**
 * Advisory client-side check of whether `product` matches a campaign's
 * `productScope`, for display purposes only.
 *
 * **This is a display hint, not an eligibility check.** The backend's
 * `RuleConditionEvaluator` (`services/backend/src/domain/campaign/services/RuleConditionEvaluator.ts`)
 * remains the sole authority on which line items actually earn a reward at
 * purchase time — this function only helps a merchant page decide which
 * campaign to *feature* on a product page, and never gates or blocks a
 * reward. It fails OPEN: any condition it cannot confidently evaluate
 * (unknown operator, missing product field, a malformed operand) is treated
 * as a match, so this helper can never hide a reward the backend would
 * actually pay. It only supports the backend's allowlisted `productScope`
 * fields and operators (see `ProductScopeTarget` and
 * `CampaignManagementService.PRODUCT_SCOPE_FIELDS`); a `productScope` field
 * outside that allowlist cannot exist on a published campaign.
 *
 * @param scope - A campaign's `productScope` (or `undefined` for an
 * unscoped campaign, which trivially matches every product).
 * @param product - The identifiers of the product currently on display.
 */
export function matchesProductScope(
    scope: RuleConditions | undefined,
    product: ProductScopeTarget
): boolean {
    if (!scope) return true;
    if (Array.isArray(scope)) {
        return scope.every((condition) => evaluateNode(condition, product));
    }
    return evaluateNode(scope, product);
}
