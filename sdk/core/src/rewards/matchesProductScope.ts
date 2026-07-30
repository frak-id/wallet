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

// A number, or a string that fully parses as a finite number. A campaign's
// numeric threshold is routinely authored as a string in JSON (`"79.90"`),
// and a product's numeric fields routinely arrive as strings too (HTML
// attributes, URL query params), so numeric intent must be recognised on
// either side.
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

// Mirrors the backend's `compareValues` ordering semantics: numeric whenever
// both sides are numeric (even as strings), lexicographic only for genuine
// text. A plain `String()` fallback would rank "9" above "10" and make every
// price/quantity threshold silently wrong.
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
    // Missing field: non-evaluable, fail open (matches) — deliberate
    // divergence from the backend, which hard-fails `in` to `false` (and
    // `not_in` to `true`) here because it evaluates a complete purchase line
    // item. Client-side absence just means the integrator didn't supply that
    // field, not that it's actually missing, so we can't assert a match or
    // non-match either way.
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
 * Evaluate a single leaf condition against a product. Returns `undefined`
 * (rather than `true`/`false`) when the condition cannot be meaningfully
 * evaluated on the client — an unknown operator, or an array operand on a
 * scalar/string operator that the backend would reject at publish time (so
 * seeing one here means the SDK's operator/field list has drifted from the
 * backend's). Callers fail OPEN on `undefined` — see module doc.
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
    product: ProductDetails
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
 * fields and operators (see `ProductDetails` and
 * `CampaignManagementService.PRODUCT_SCOPE_FIELDS`); a `productScope` field
 * outside that allowlist cannot exist on a published campaign.
 *
 * @param scope - A campaign's `productScope` (or `undefined` for an
 * unscoped campaign, which trivially matches every product).
 * @param product - The identifiers of the product currently on display.
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
