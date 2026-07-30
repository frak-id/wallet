import { describe, expect, test } from "vitest";
import type { CampaignDraft } from "@/stores/campaignStore";
import {
    DEFAULT_PRODUCTS_FORM,
    draftToProductsForm,
    isAdvancedScope,
    isEditableCondition,
    isProductsFormValid,
    operatorsFor,
    type ProductsFormValues,
    productsFormToCondition,
    productsFormToDraft,
} from "./utils";

const baseDraft: CampaignDraft = {
    merchantId: "merchant-1",
    name: "Test",
    rule: {
        trigger: "purchase",
        conditions: [],
        rewards: [],
    },
    metadata: {},
    budgetConfig: [],
    priority: 0,
};

const form = (overrides: Partial<ProductsFormValues>): ProductsFormValues => ({
    ...DEFAULT_PRODUCTS_FORM,
    ...overrides,
});

describe("productsFormToCondition", () => {
    test("returns null for the all-products mode", () => {
        expect(productsFormToCondition(form({ mode: "all" }))).toBeNull();
    });

    test("builds a list condition, dropping blank rows", () => {
        expect(
            productsFormToCondition(
                form({
                    mode: "specific",
                    operator: "in",
                    values: ["A-S", "  ", "A-M"],
                })
            )
        ).toEqual({ field: "sku", operator: "in", value: ["A-S", "A-M"] });
    });

    test("trims text values", () => {
        expect(
            productsFormToCondition(
                form({ mode: "specific", operator: "eq", values: [" A-S "] })
            )
        ).toEqual({ field: "sku", operator: "eq", value: "A-S" });
    });

    test("uses only the first value for a scalar operator", () => {
        expect(
            productsFormToCondition(
                form({
                    mode: "specific",
                    operator: "eq",
                    values: ["A-S", "A-M"],
                })
            )
        ).toEqual({ field: "sku", operator: "eq", value: "A-S" });
    });

    test("parses numeric fields as numbers", () => {
        expect(
            productsFormToCondition(
                form({
                    mode: "specific",
                    field: "unitPrice",
                    operator: "gte",
                    values: ["49.90"],
                })
            )
        ).toEqual({ field: "unitPrice", operator: "gte", value: 49.9 });
    });

    test("rejects a non-numeric value on a numeric field", () => {
        expect(
            productsFormToCondition(
                form({
                    mode: "specific",
                    field: "quantity",
                    operator: "gte",
                    values: ["many"],
                })
            )
        ).toBeNull();
    });

    test("between carries valueTo", () => {
        expect(
            productsFormToCondition(
                form({
                    mode: "specific",
                    field: "unitPrice",
                    operator: "between",
                    values: ["10"],
                    valueTo: "50",
                })
            )
        ).toEqual({
            field: "unitPrice",
            operator: "between",
            value: 10,
            valueTo: 50,
        });
    });

    test("between without an upper bound is incomplete", () => {
        expect(
            productsFormToCondition(
                form({
                    mode: "specific",
                    field: "unitPrice",
                    operator: "between",
                    values: ["10"],
                    valueTo: "",
                })
            )
        ).toBeNull();
    });
});

describe("isProductsFormValid", () => {
    test("all-products is always valid", () => {
        expect(isProductsFormValid(form({ mode: "all", values: [""] }))).toBe(
            true
        );
    });

    test("a specific scope with no usable value is invalid", () => {
        expect(
            isProductsFormValid(form({ mode: "specific", values: ["  "] }))
        ).toBe(false);
    });

    test("a specific scope with a value is valid", () => {
        expect(
            isProductsFormValid(form({ mode: "specific", values: ["A-S"] }))
        ).toBe(true);
    });
});

describe("operatorsFor", () => {
    test("numeric fields get comparison operators, not string ones", () => {
        const operators = operatorsFor("quantity");
        expect(operators).toContain("between");
        expect(operators).not.toContain("starts_with");
    });

    test("text fields get string operators, not comparisons", () => {
        const operators = operatorsFor("sku");
        expect(operators).toContain("starts_with");
        expect(operators).not.toContain("between");
    });
});

describe("productsFormToDraft", () => {
    test("clears the scope in all-products mode", () => {
        const scoped: CampaignDraft = {
            ...baseDraft,
            rule: {
                ...baseDraft.rule,
                productScope: [{ field: "sku", operator: "eq", value: "A-S" }],
            },
        };
        const next = productsFormToDraft(form({ mode: "all" }), scoped);
        expect(next.rule.productScope).toBeUndefined();
    });

    test("leaves an uneditable scope untouched", () => {
        const advanced: CampaignDraft = {
            ...baseDraft,
            rule: {
                ...baseDraft.rule,
                productScope: {
                    logic: "any",
                    conditions: [
                        { field: "sku", operator: "eq", value: "A-S" },
                        { field: "sku", operator: "eq", value: "A-M" },
                    ],
                },
            },
        };
        const next = productsFormToDraft(form({ mode: "all" }), advanced);
        expect(next.rule.productScope).toEqual(advanced.rule.productScope);
    });
});

describe("draftToProductsForm", () => {
    test("round-trips a list scope", () => {
        const scoped: CampaignDraft = {
            ...baseDraft,
            rule: {
                ...baseDraft.rule,
                productScope: [
                    { field: "sku", operator: "not_in", value: ["CHEAP"] },
                ],
            },
        };
        expect(draftToProductsForm(scoped)).toMatchObject({
            mode: "specific",
            field: "sku",
            operator: "not_in",
            values: ["CHEAP"],
        });
    });

    test("an unscoped draft reads as all-products", () => {
        expect(draftToProductsForm(baseDraft).mode).toBe("all");
    });

    test("an uneditable scope falls back to the default form", () => {
        const advanced: CampaignDraft = {
            ...baseDraft,
            rule: {
                ...baseDraft.rule,
                productScope: {
                    logic: "all",
                    conditions: [
                        { field: "sku", operator: "eq", value: "A" },
                        { field: "quantity", operator: "gte", value: 2 },
                    ],
                },
            },
        };
        expect(draftToProductsForm(advanced)).toEqual(DEFAULT_PRODUCTS_FORM);
    });
});

describe("isEditableCondition", () => {
    test("accepts a condition the selects can represent", () => {
        expect(
            isEditableCondition({
                field: "sku",
                operator: "in",
                value: ["A"],
            })
        ).toBe(true);
    });

    // The backend allows these; the wizard deliberately doesn't offer them.
    // Feeding one to the operator Select would render it blank and let the
    // merchant overwrite a predicate they never saw.
    test.each(["exists", "not_exists", "ends_with"] as const)(
        "rejects the unlisted operator %s",
        (operator) => {
            expect(
                isEditableCondition({ field: "sku", operator, value: "A" })
            ).toBe(false);
        }
    );

    test("rejects an operator of the wrong kind for the field", () => {
        expect(
            isEditableCondition({
                field: "quantity",
                operator: "starts_with",
                value: "1",
            })
        ).toBe(false);
    });

    test("rejects a field outside the allowlist", () => {
        expect(
            isEditableCondition({
                field: "category",
                operator: "eq",
                value: "shoes",
            })
        ).toBe(false);
    });
});

describe("isAdvancedScope", () => {
    test("an unlisted operator makes the scope read-only", () => {
        const draft: CampaignDraft = {
            ...baseDraft,
            rule: {
                ...baseDraft.rule,
                productScope: [
                    { field: "sku", operator: "exists", value: true },
                ],
            },
        };
        expect(isAdvancedScope(draft)).toBe(true);
        expect(draftToProductsForm(draft)).toEqual(DEFAULT_PRODUCTS_FORM);
        // ...and the step must not rewrite it on save.
        expect(productsFormToDraft(form({ mode: "all" }), draft)).toBe(draft);
    });

    test("an unscoped draft is not advanced", () => {
        expect(isAdvancedScope(baseDraft)).toBe(false);
    });
});
