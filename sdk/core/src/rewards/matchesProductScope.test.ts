import { describe, expect, it } from "vitest";
import type {
    ConditionGroup,
    ProductDetails,
    RuleCondition,
    RuleConditions,
} from "../types";
import goldenScopeMatch from "./fixtures/golden-scope-match.json";
import { matchesProductScope } from "./matchesProductScope";
import {
    ARRAY_OPERATORS,
    EXISTENCE_OPERATORS,
    SCALAR_OPERATORS,
    STRING_OPERATORS,
} from "./operators";

const product: ProductDetails = {
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
        // `exists` is evaluable on an absent field: a real "no", not a
        // non-evaluable condition.
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

// Parity test against the backend's field allowlist (`PRODUCT_SCOPE_FIELDS` in
// CampaignManagementService.ts), copied by hand — no shared import across the
// SDK/backend boundary. The operator list is derived from `operators.ts`, which
// the backend imports, so a new operator fails the outcome table on its own.
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
        ...SCALAR_OPERATORS,
        ...ARRAY_OPERATORS,
        ...STRING_OPERATORS,
        ...EXISTENCE_OPERATORS,
    ];

    it("ProductDetails has exactly the backend's allowlisted fields", () => {
        const target: Required<ProductDetails> = {
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

    // An outcome per operator, each chosen so the fail-open default (`true`)
    // is the WRONG answer: deleting an operator's branch turns it red.
    const OPERATOR_OUTCOMES: {
        operator: (typeof BACKEND_OPERATORS)[number];
        condition: Omit<RuleCondition, "field">;
        expected: boolean;
    }[] = [
        {
            operator: "eq",
            condition: { operator: "eq", value: "OTHER" },
            expected: false,
        },
        {
            operator: "neq",
            condition: { operator: "neq", value: "SHOE-42" },
            expected: false,
        },
        {
            operator: "gt",
            condition: { operator: "gt", value: "ZZZZ" },
            expected: false,
        },
        {
            operator: "gte",
            condition: { operator: "gte", value: "ZZZZ" },
            expected: false,
        },
        {
            operator: "lt",
            condition: { operator: "lt", value: "AAAA" },
            expected: false,
        },
        {
            operator: "lte",
            condition: { operator: "lte", value: "AAAA" },
            expected: false,
        },
        {
            operator: "between",
            condition: { operator: "between", value: "AAAA", valueTo: "BBBB" },
            expected: false,
        },
        {
            operator: "in",
            condition: { operator: "in", value: ["OTHER"] },
            expected: false,
        },
        {
            operator: "not_in",
            condition: { operator: "not_in", value: ["SHOE-42"] },
            expected: false,
        },
        {
            operator: "contains",
            condition: { operator: "contains", value: "BOOT" },
            expected: false,
        },
        {
            operator: "starts_with",
            condition: { operator: "starts_with", value: "BOOT" },
            expected: false,
        },
        {
            operator: "ends_with",
            condition: { operator: "ends_with", value: "BOOT" },
            expected: false,
        },
        {
            operator: "not_exists",
            condition: { operator: "not_exists", value: null },
            expected: false,
        },
    ];

    it("covers every backend operator in the outcome table", () => {
        const covered = OPERATOR_OUTCOMES.map((entry) => entry.operator);
        expect([...covered, "exists"].sort()).toEqual(
            [...BACKEND_OPERATORS].sort()
        );
    });

    it.each(OPERATOR_OUTCOMES)(
        "$operator returns the evaluated outcome, not the fail-open default",
        ({ condition, expected }) => {
            const scope = [
                { field: "sku", ...condition },
            ] as unknown as RuleConditions;
            expect(matchesProductScope(scope, product)).toBe(expected);
        }
    );

    it("exists returns true on a populated field and false on an absent one", () => {
        const scope: RuleConditions = [
            { field: "sku", operator: "exists", value: null },
        ];
        expect(matchesProductScope(scope, product)).toBe(true);
        expect(matchesProductScope(scope, {})).toBe(false);
    });
});

describe("matchesProductScope — numeric comparison with string operands", () => {
    // A JSON-string threshold compared against a numeric product field: a
    // lexicographic fallback would rank "9" above "10".
    it("compares a numeric-string condition value numerically, not lexicographically", () => {
        const cheap: ProductDetails = { unitPrice: 9 };
        const pricey: ProductDetails = { unitPrice: 10 };

        // 9 > "10" must be false — lexicographically "9" > "10" is true.
        expect(
            matchesProductScope(
                [{ field: "unitPrice", operator: "gt", value: "10" }],
                cheap
            )
        ).toBe(false);
        expect(
            matchesProductScope(
                [{ field: "unitPrice", operator: "gt", value: "10" }],
                { unitPrice: 11 }
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "unitPrice", operator: "lt", value: "10" }],
                cheap
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "unitPrice", operator: "gte", value: "10" }],
                pricey
            )
        ).toBe(true);
    });

    it("handles decimal string thresholds", () => {
        expect(
            matchesProductScope(
                [{ field: "unitPrice", operator: "gte", value: "79.90" }],
                { unitPrice: 79.9 }
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "unitPrice", operator: "gt", value: "79.90" }],
                { unitPrice: 79.9 }
            )
        ).toBe(false);
    });

    it("compares between bounds numerically when authored as strings", () => {
        const scope: RuleConditions = [
            {
                field: "unitPrice",
                operator: "between",
                value: "9",
                valueTo: "100",
            },
        ];
        expect(matchesProductScope(scope, { unitPrice: 50 })).toBe(true);
        // 200 is outside [9, 100]; lexicographically "200" < "9" would pass.
        expect(matchesProductScope(scope, { unitPrice: 200 })).toBe(false);
    });

    it("still compares genuine text lexicographically", () => {
        expect(
            matchesProductScope(
                [{ field: "name", operator: "gt", value: "A" }],
                {
                    name: "B",
                }
            )
        ).toBe(true);
        expect(
            matchesProductScope(
                [{ field: "name", operator: "gt", value: "Z" }],
                {
                    name: "B",
                }
            )
        ).toBe(false);
    });
});

type ScopeMatchFixture = {
    name: string;
    description: string;
    kind: "scope-match";
    divergence?: "fail-open-vs-fail-closed";
    scope: RuleConditions;
    product: ProductDetails;
    sdk: boolean;
    backend: boolean;
};

// The JSON import is inferred as a union of per-entry literal shapes, which
// narrows to `never` under a type predicate. Widen ONCE to the declared
// fixture type so the payload fields stay genuinely type-checked and a corpus
// shape drift is a type error rather than a silent pass.
const scopeMatchFixtures = (
    goldenScopeMatch.fixtures as unknown as ScopeMatchFixture[]
).filter(
    (fixture): fixture is ScopeMatchFixture => fixture.kind === "scope-match"
);

describe("matchesProductScope — shared scope-match corpus", () => {
    it("loads every corpus entry the backend evaluator suite also asserts against", () => {
        expect(scopeMatchFixtures.length).toBe(23);
    });

    it.each(scopeMatchFixtures)(
        "$name: $description",
        ({ scope, product: fixtureProduct, sdk }) => {
            expect(matchesProductScope(scope, fixtureProduct)).toBe(sdk);
        }
    );

    it("pins every deliberate SDK/backend divergence as fail-open vs fail-closed", () => {
        const diverging = scopeMatchFixtures.filter(
            (fixture) => fixture.sdk !== fixture.backend
        );
        expect(diverging.length).toBeGreaterThan(0);
        for (const fixture of diverging) {
            expect(fixture.divergence).toBe("fail-open-vs-fail-closed");
            expect(fixture.sdk).toBe(true);
            expect(fixture.backend).toBe(false);
        }
    });
});
