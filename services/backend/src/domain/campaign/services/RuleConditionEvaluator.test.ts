import { describe, expect, it } from "vitest";
import type { ConditionGroup, RuleCondition } from "../types";
import { RuleConditionEvaluator } from "./RuleConditionEvaluator";

const evaluator = new RuleConditionEvaluator();

// productScope items — evaluated with the item itself as the root object
// (`field: "productId"`, not `field: "purchase.items.productId"`).
const itemA = {
    productId: "A",
    name: "Widget",
    quantity: 2,
    unitPrice: 10,
    totalPrice: 20,
};
const itemB = {
    productId: "B",
    name: "Gadget",
    quantity: 1,
    unitPrice: 25,
    totalPrice: 25,
};

describe("RuleConditionEvaluator.evaluate — item-level matching", () => {
    it("eq matches a single product id", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "eq",
            value: "A",
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(true);
        expect(evaluator.evaluate([condition], itemB)).toBe(false);
    });

    it("neq matches everything but the excluded product", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "neq",
            value: "A",
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
        expect(evaluator.evaluate([condition], itemB)).toBe(true);
    });

    it("in matches any product id in the list", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "in",
            value: ["A", "C"],
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(true);
        expect(evaluator.evaluate([condition], itemB)).toBe(false);
    });

    it("not_in selects the complement set", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "not_in",
            value: ["A"],
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
        expect(evaluator.evaluate([condition], itemB)).toBe(true);
    });

    it("contains matches a substring of the item name", () => {
        const condition: RuleCondition = {
            field: "name",
            operator: "contains",
            value: "idg",
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(true);
        expect(evaluator.evaluate([condition], itemB)).toBe(false);
    });

    it("starts_with matches a name prefix", () => {
        const condition: RuleCondition = {
            field: "name",
            operator: "starts_with",
            value: "Gad",
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
        expect(evaluator.evaluate([condition], itemB)).toBe(true);
    });

    it("evaluates a nested ConditionGroup against an item", () => {
        const group: ConditionGroup = {
            logic: "any",
            conditions: [
                { field: "productId", operator: "eq", value: "A" },
                {
                    logic: "all",
                    conditions: [
                        { field: "productId", operator: "eq", value: "B" },
                        { field: "quantity", operator: "eq", value: 1 },
                    ],
                },
            ],
        };
        expect(evaluator.evaluate(group, itemA)).toBe(true);
        expect(evaluator.evaluate(group, itemB)).toBe(true);
        expect(
            evaluator.evaluate(group, {
                ...itemB,
                productId: "C",
            })
        ).toBe(false);
    });

    it("negation under a matched-set filter yields the complement, not a cart-wide veto", () => {
        // Mirrors RuleEngineService: the matched set is every item satisfying
        // the scope, independently.
        const scope: RuleCondition[] = [
            { field: "productId", operator: "not_in", value: ["CHEAP"] },
        ];
        const cart = [
            {
                productId: "CHEAP",
                name: "Loss leader",
                quantity: 1,
                unitPrice: 1,
                totalPrice: 1,
            },
            {
                productId: "NORMAL",
                name: "Regular",
                quantity: 1,
                unitPrice: 50,
                totalPrice: 50,
            },
        ];
        const matched = cart.filter((item) => evaluator.evaluate(scope, item));
        expect(matched).toEqual([cart[1]]);

        const cheapOnlyCart = [cart[0]];
        const matchedCheapOnly = cheapOnlyCart.filter((item) =>
            evaluator.evaluate(scope, item)
        );
        expect(matchedCheapOnly).toEqual([]);
    });
});

describe("RuleConditionEvaluator.evaluate — unchanged behavior for RuleContext", () => {
    it("still evaluates order-level conditions against the full context", () => {
        const context = {
            user: { identityGroupId: "u1", walletAddress: null },
            time: {
                dayOfWeek: 1,
                hourOfDay: 1,
                date: "2025-01-01",
                timestamp: 0,
            },
            purchase: {
                orderId: "o1",
                amount: 100,
                currency: "usd",
                items: [],
            },
        };
        const condition: RuleCondition = {
            field: "purchase.amount",
            operator: "gte",
            value: 50,
        };
        expect(evaluator.evaluate([condition], context)).toBe(true);
    });
});

describe("RuleConditionEvaluator — array operand guard on scalar/string operators", () => {
    // Order-level `conditions` are not field-allowlisted, so a malformed
    // payload can hand a scalar operator an array value. Those must fail closed
    // rather than `===`/`String()`-coerce into a meaningless comparison.
    it("neq with an array value returns false, not true", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "neq",
            value: ["A", "B"],
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
    });

    it("eq with an array value returns false", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "eq",
            value: ["A"],
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
    });

    it("gt with an array value returns false instead of a lexicographic compare", () => {
        const condition: RuleCondition = {
            field: "unitPrice",
            operator: "gt",
            value: [1],
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
    });

    it("between with an array valueTo returns false", () => {
        const condition: RuleCondition = {
            field: "unitPrice",
            operator: "between",
            value: 1,
            valueTo: [100] as unknown as number,
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
    });

    it("contains with an array value returns false", () => {
        const condition: RuleCondition = {
            field: "name",
            operator: "contains",
            value: ["Widget"],
        };
        expect(evaluator.evaluate([condition], itemA)).toBe(false);
    });

    it("in and not_in still work with array values (unaffected by the guard)", () => {
        const inCondition: RuleCondition = {
            field: "productId",
            operator: "in",
            value: ["A", "C"],
        };
        const notInCondition: RuleCondition = {
            field: "productId",
            operator: "not_in",
            value: ["B"],
        };
        expect(evaluator.evaluate([inCondition], itemA)).toBe(true);
        expect(evaluator.evaluate([notInCondition], itemA)).toBe(true);
    });
});

describe("RuleConditionEvaluator — numeric comparison with string operands", () => {
    // Thresholds arrive from JSON as strings ("10") while the item field is a
    // real number: a lexicographic fallback would rank "9" above "10".
    const cheap = { unitPrice: 9, quantity: 9 };
    const pricey = { unitPrice: 10, quantity: 10 };

    it("compares a numeric-string condition value numerically", () => {
        const gt: RuleCondition = {
            field: "unitPrice",
            operator: "gt",
            value: "10",
        };
        expect(evaluator.evaluate([gt], cheap)).toBe(false);
        expect(evaluator.evaluate([gt], { unitPrice: 11 })).toBe(true);

        const lt: RuleCondition = {
            field: "unitPrice",
            operator: "lt",
            value: "10",
        };
        expect(evaluator.evaluate([lt], cheap)).toBe(true);

        const gte: RuleCondition = {
            field: "unitPrice",
            operator: "gte",
            value: "10",
        };
        expect(evaluator.evaluate([gte], pricey)).toBe(true);
    });

    it("handles decimal string thresholds", () => {
        const gte: RuleCondition = {
            field: "unitPrice",
            operator: "gte",
            value: "79.90",
        };
        expect(evaluator.evaluate([gte], { unitPrice: 79.9 })).toBe(true);

        const gt: RuleCondition = {
            field: "unitPrice",
            operator: "gt",
            value: "79.90",
        };
        expect(evaluator.evaluate([gt], { unitPrice: 79.9 })).toBe(false);
    });

    it("compares between bounds numerically when authored as strings", () => {
        const between: RuleCondition = {
            field: "unitPrice",
            operator: "between",
            value: "9",
            valueTo: "100",
        };
        expect(evaluator.evaluate([between], { unitPrice: 50 })).toBe(true);
        // 200 is outside [9, 100]; lexicographically "200" < "9" would pass.
        expect(evaluator.evaluate([between], { unitPrice: 200 })).toBe(false);
    });

    it("still compares genuine text lexicographically", () => {
        const gt: RuleCondition = {
            field: "name",
            operator: "gt",
            value: "A",
        };
        expect(evaluator.evaluate([gt], { name: "B" })).toBe(true);
        expect(evaluator.evaluate([gt], { name: "0" })).toBe(false);
    });
});
