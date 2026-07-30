import {
    type CampaignDraft,
    getProductScopeCondition,
    PRODUCT_SCOPE_FIELDS,
    type ProductScopeField,
    setProductScope,
} from "@/stores/campaignStore";
import type { RuleCondition } from "@/types/Campaign";

/**
 * Operators the wizard exposes, per field kind. A deliberate subset of what
 * the backend accepts: `exists`/`not_exists` on a line-item field describe
 * "the cart contains an item that has a SKU at all", which is never what a
 * merchant means, and `ends_with` has no product use case worth a row.
 */
export const TEXT_OPERATORS = [
    "in",
    "not_in",
    "eq",
    "neq",
    "starts_with",
    "contains",
] as const;

export const NUMERIC_OPERATORS = [
    "gte",
    "lte",
    "gt",
    "lt",
    "eq",
    "between",
] as const;

export type ProductScopeOperator =
    | (typeof TEXT_OPERATORS)[number]
    | (typeof NUMERIC_OPERATORS)[number];

const NUMERIC_FIELDS = new Set<ProductScopeField>([
    "quantity",
    "unitPrice",
    "totalPrice",
]);

export function isNumericField(field: ProductScopeField): boolean {
    return NUMERIC_FIELDS.has(field);
}

const LIST_OPERATORS = new Set<ProductScopeOperator>(["in", "not_in"]);

export function isListOperator(operator: ProductScopeOperator): boolean {
    return LIST_OPERATORS.has(operator);
}

export function operatorsFor(
    field: ProductScopeField
): readonly ProductScopeOperator[] {
    return isNumericField(field) ? NUMERIC_OPERATORS : TEXT_OPERATORS;
}

export type ProductScopeMode = "all" | "specific";

export type ProductsFormValues = {
    mode: ProductScopeMode;
    field: ProductScopeField;
    operator: ProductScopeOperator;
    /**
     * Values as typed. A list operator uses every non-empty entry; a scalar
     * operator uses only the first. Kept as one array so switching operator
     * never drops what the merchant already typed.
     */
    values: string[];
    /** Upper bound, `between` only. */
    valueTo: string;
};

export const DEFAULT_PRODUCTS_FORM: ProductsFormValues = {
    mode: "all",
    field: "sku",
    operator: "in",
    values: [""],
    valueTo: "",
};

function parseValue(
    raw: string,
    field: ProductScopeField
): string | number | undefined {
    const trimmed = raw.trim();
    if (trimmed === "") return undefined;
    if (!isNumericField(field)) return trimmed;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The backend accepts operators the step doesn't offer (`exists`,
 * `not_exists`, `ends_with`). Feeding one to the selects renders them blank,
 * letting a merchant overwrite a predicate they never saw.
 */
export function isEditableCondition(condition: RuleCondition): boolean {
    const field = condition.field as ProductScopeField;
    if (!PRODUCT_SCOPE_FIELDS.includes(field)) return false;
    return (operatorsFor(field) as readonly string[]).includes(
        condition.operator
    );
}

/** The scope the step can edit, if any. */
export function editableScopeCondition(
    draft: CampaignDraft
): RuleCondition | undefined {
    const condition = getProductScopeCondition(draft.rule);
    return condition && isEditableCondition(condition) ? condition : undefined;
}

/** A scope exists, but only read-only rendering can represent it. */
export function isAdvancedScope(draft: CampaignDraft): boolean {
    return !!draft.rule.productScope && !editableScopeCondition(draft);
}

export function draftToProductsForm(draft: CampaignDraft): ProductsFormValues {
    const condition = editableScopeCondition(draft);
    if (!condition) return DEFAULT_PRODUCTS_FORM;

    const field = condition.field as ProductScopeField;
    const operator = condition.operator as ProductScopeOperator;
    const raw = condition.value;
    const values = Array.isArray(raw)
        ? raw.map(String)
        : [raw === null || raw === undefined ? "" : String(raw)];

    return {
        mode: "specific",
        field,
        operator,
        values: values.length > 0 ? values : [""],
        valueTo:
            condition.valueTo === undefined || condition.valueTo === null
                ? ""
                : String(condition.valueTo),
    };
}

/** Build the rule condition, or `null` when the form describes no scope. */
export function productsFormToCondition(
    values: ProductsFormValues
): RuleCondition | null {
    if (values.mode === "all") return null;

    const { field, operator } = values;
    const parsed = values.values
        .map((value) => parseValue(value, field))
        .filter((value): value is string | number => value !== undefined);

    if (parsed.length === 0) return null;

    if (isListOperator(operator)) {
        return { field, operator, value: parsed };
    }

    const condition: RuleCondition = {
        field,
        operator,
        value: parsed[0],
    };

    if (operator === "between") {
        const valueTo = parseValue(values.valueTo, field);
        if (valueTo === undefined) return null;
        return { ...condition, valueTo };
    }

    return condition;
}

export function productsFormToDraft(
    values: ProductsFormValues,
    draft: CampaignDraft
): CampaignDraft {
    // No form representation — leave the scope untouched rather than flatten
    // it into whatever the disabled form holds.
    if (isAdvancedScope(draft)) return draft;
    return {
        ...draft,
        rule: setProductScope(draft.rule, productsFormToCondition(values)),
    };
}

/** Continue gating: a specific scope needs a condition the backend accepts. */
export function isProductsFormValid(values: ProductsFormValues): boolean {
    if (values.mode === "all") return true;
    return productsFormToCondition(values) !== null;
}
