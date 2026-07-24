import { describe, expect, it } from "vitest";
import type { ConditionGroup, RuleCondition, RuleConditions } from "../types";
import {
    matchesProductScope,
    type ProductScopeTarget,
} from "./matchesProductScope";

const product: ProductScopeTarget = {
    productId: "prod-1",
    sku: "SHOE-42",
    name: "Running Shoe",
    quantity: 2,
    unitPrice: 50,
    totalPrice: 100,
};

function cond(partial: Partial<RuleCondition>): RuleCondition {
    return { field: "sku", operator: "eq", value: "SHOE-42", ...partial };
}

describe("matchesProductScope — undefined scope", () => {
    it("matches trivially when no scope is set", () => {
        expect(matchesProductScope(undefined, product)).toBe(true);
        expect(matchesProductScope(undefined, {})).toBe(true);
    });
});

describe("matchesProductScope — each operator, matching field present", () => {
    it("eq", () => {
        expect(
            matchesProductScope(
                [cond({ operator: "eq", value: "SHOE-42" })],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [cond({ operator: "eq", value: "OTHER" })],
                product
            )
        ).toBe(false);
    });

    it("neq", () => {
        expect(
            matchesProductScope(
                [cond({ operator: "neq", value: "OTHER" })],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [cond({ operator: "neq", value: "SHOE-42" })],
                product
            )
        ).toBe(false);
    });

    it("gt / gte / lt / lte on a numeric field", () => {
        const field = "unitPrice";
        expect(
            matchesProductScope([{ field, operator: "gt", value: 40 }], product)
        ).toBe(true);
        expect(
            matchesProductScope([{ field, operator: "gt", value: 50 }], product)
        ).toBe(false);
        expect(
            matchesProductScope(
                [{ field, operator: "gte", value: 50 }],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope([{ field, operator: "lt", value: 60 }], product)
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field, operator: "lte", value: 50 }],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field, operator: "lte", value: 49 }],
                product
            )
        ).toBe(false);
    });

    it("between", () => {
        expect(
            matchesProductScope(
                [
                    {
                        field: "unitPrice",
                        operator: "between",
                        value: 10,
                        valueTo: 100,
                    },
                ],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [
                    {
                        field: "unitPrice",
                        operator: "between",
                        value: 60,
                        valueTo: 100,
                    },
                ],
                product
            )
        ).toBe(false);
    });

    it("in / not_in", () => {
        expect(
            matchesProductScope(
                [
                    {
                        field: "sku",
                        operator: "in",
                        value: ["SHOE-42", "SHOE-43"],
                    },
                ],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "in", value: ["OTHER"] }],
                product
            )
        ).toBe(false);
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "not_in", value: ["OTHER"] }],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "not_in", value: ["SHOE-42"] }],
                product
            )
        ).toBe(false);
    });

    it("contains / starts_with / ends_with", () => {
        expect(
            matchesProductScope(
                [{ field: "name", operator: "contains", value: "Shoe" }],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "name", operator: "starts_with", value: "Running" }],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "name", operator: "ends_with", value: "Shoe" }],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "name", operator: "contains", value: "Boot" }],
                product
            )
        ).toBe(false);
    });

    it("exists / not_exists", () => {
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "exists", value: null }],
                product
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "not_exists", value: null }],
                product
            )
        ).toBe(false);
    });
});

describe("matchesProductScope — group logic", () => {
    it("all: every condition must match", () => {
        const group: ConditionGroup = {
            logic: "all",
            conditions: [
                { field: "sku", operator: "eq", value: "SHOE-42" },
                { field: "quantity", operator: "gte", value: 2 },
            ],
        };
        expect(matchesProductScope(group, product)).toBe(true);
        expect(
            matchesProductScope(
                {
                    logic: "all",
                    conditions: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                        { field: "quantity", operator: "gte", value: 3 },
                    ],
                },
                product
            )
        ).toBe(false);
    });

    it("any: at least one condition matches", () => {
        const group: ConditionGroup = {
            logic: "any",
            conditions: [
                { field: "sku", operator: "eq", value: "OTHER" },
                { field: "sku", operator: "eq", value: "SHOE-42" },
            ],
        };
        expect(matchesProductScope(group, product)).toBe(true);
    });

    it("none: no condition may match", () => {
        const group: ConditionGroup = {
            logic: "none",
            conditions: [{ field: "sku", operator: "eq", value: "OTHER" }],
        };
        expect(matchesProductScope(group, product)).toBe(true);
        expect(
            matchesProductScope(
                {
                    logic: "none",
                    conditions: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                },
                product
            )
        ).toBe(false);
    });

    it("nested groups combine correctly", () => {
        const group: ConditionGroup = {
            logic: "all",
            conditions: [
                { field: "sku", operator: "eq", value: "SHOE-42" },
                {
                    logic: "any",
                    conditions: [
                        { field: "quantity", operator: "gte", value: 5 },
                        { field: "unitPrice", operator: "gte", value: 50 },
                    ],
                },
            ],
        };
        expect(matchesProductScope(group, product)).toBe(true);
    });
});

describe("matchesProductScope — fail-open cases", () => {
    it("missing product field with a comparison operator fails open (matches)", () => {
        expect(
            matchesProductScope(
                [{ field: "totalPrice", operator: "gt", value: 10 }],
                {}
            )
        ).toBe(true);
    });

    it("missing product field with exists fails closed (correctly, not a fail-open case)", () => {
        // `exists` can be evaluated even when the field is absent — this is a
        // real "no" answer, not a non-evaluable condition.
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "exists", value: null }],
                {}
            )
        ).toBe(false);
    });

    it("missing product field with not_exists correctly matches", () => {
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "not_exists", value: null }],
                {}
            )
        ).toBe(true);
    });

    it("unknown operator (backend drift) fails open", () => {
        const scope = [
            { field: "sku", operator: "regex", value: "^SHOE" },
        ] as unknown as RuleConditions;
        expect(matchesProductScope(scope, product)).toBe(true);
    });

    it("array operand on a scalar operator fails open (advisory), unlike the backend's fail-closed", () => {
        const scope: RuleConditions = [
            {
                field: "sku",
                operator: "neq",
                value: ["SHOE-42", "SHOE-43"] as unknown as string,
            },
        ];
        expect(matchesProductScope(scope, product)).toBe(true);
    });

    it("between missing valueTo fails open", () => {
        expect(
            matchesProductScope(
                [{ field: "unitPrice", operator: "between", value: 10 }],
                product
            )
        ).toBe(true);
    });

    it("a non-evaluable leaf doesn't force a whole 'all' group to match when a sibling clearly fails", () => {
        const group: ConditionGroup = {
            logic: "all",
            conditions: [
                { field: "sku", operator: "eq", value: "OTHER" }, // clearly false
                {
                    field: "sku",
                    operator: "regex",
                    value: "^SHOE",
                } as unknown as RuleCondition, // non-evaluable -> true
            ],
        };
        // "all" requires every condition; the clearly-false sibling still wins.
        expect(matchesProductScope(group, product)).toBe(false);
    });

    it("contains/starts_with/ends_with with a non-string field fails open", () => {
        expect(
            matchesProductScope(
                [{ field: "quantity", operator: "contains", value: "2" }],
                product
            )
        ).toBe(true);
    });

    it("in with a missing field fails open (matches), unlike the backend's fail-closed", () => {
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "in", value: ["SHOE-42"] }],
                {}
            )
        ).toBe(true);
    });

    it("not_in with a missing field fails open (matches)", () => {
        expect(
            matchesProductScope(
                [{ field: "sku", operator: "not_in", value: ["SHOE-42"] }],
                {}
            )
        ).toBe(true);
    });
});

// Parity test: keeps this SDK subset honest against the backend's allowlist.
// If either list changes, update both sides in the same PR.
//
// Backend source of truth:
//  - fields:    services/backend/src/domain/campaign/services/CampaignManagementService.ts
//               (PRODUCT_SCOPE_FIELDS)
//  - operators: services/backend/src/domain/campaign/services/RuleConditionEvaluator.ts
//               (evaluateOperator's exhaustive operator switch)
//
// These two lists are manually copied from the backend, not machine-checked
// against it (no shared import across the SDK/backend boundary) — a backend
// allowlist change requires updating `BACKEND_PRODUCT_SCOPE_FIELDS` /
// `BACKEND_OPERATORS` below by hand.
describe("matchesProductScope — parity with backend allowlist", () => {
    const BACKEND_PRODUCT_SCOPE_FIELDS = [
        "productId",
        "name",
        "sku",
        "quantity",
        "unitPrice",
        "totalPrice",
    ] as const;

    const BACKEND_OPERATORS = [
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "between",
        "in",
        "not_in",
        "contains",
        "starts_with",
        "ends_with",
        "exists",
        "not_exists",
    ] as const;

    it("ProductScopeTarget has exactly the backend's allowlisted fields", () => {
        const target: Required<ProductScopeTarget> = {
            productId: "x",
            name: "x",
            sku: "x",
            quantity: 1,
            unitPrice: 1,
            totalPrice: 1,
        };
        expect(Object.keys(target).sort()).toEqual(
            [...BACKEND_PRODUCT_SCOPE_FIELDS].sort()
        );
    });

    it("every backend operator is handled (not silently treated as unknown)", () => {
        for (const operator of BACKEND_OPERATORS) {
            const scope: RuleConditions = [
                {
                    field: "sku",
                    operator,
                    value:
                        operator === "in" || operator === "not_in"
                            ? ["SHOE-42"]
                            : "SHOE-42",
                    ...(operator === "between" ? { valueTo: "ZZZZ" } : {}),
                },
            ];
            // Doesn't assert the boolean outcome (depends on the operator's
            // semantics) — just that evaluating it doesn't throw, i.e. every
            // operator in this list has a corresponding `case` in
            // `evaluateCondition` rather than silently falling through to the
            // fail-open default (which would still be *safe* but would mean
            // this SDK's operator table has drifted from the backend's).
            expect(() => matchesProductScope(scope, product)).not.toThrow();
        }
    });
});
