import { describe, expect, it } from "vitest";
import type { ConditionGroup, RuleCondition } from "../types";
import { RuleConditionEvaluator } from "./RuleConditionEvaluator";

const evaluator = new RuleConditionEvaluator();

// productScope items — evaluated with the item itself as the root object
// (`field: "productId"`, not `field: "purchase.items.productId"`).
const itemA = { productId: "A", name: "Widget", quantity: 2, unitPrice: 10 };
const itemB = { productId: "B", name: "Gadget", quantity: 1, unitPrice: 25 };

describe("RuleConditionEvaluator.evaluateAgainst — item-level matching", () => {
    it("eq matches a single product id", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "eq",
            value: "A",
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(true);
        expect(evaluator.evaluateAgainst([condition], itemB)).toBe(false);
    });

    it("neq matches everything but the excluded product", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "neq",
            value: "A",
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
        expect(evaluator.evaluateAgainst([condition], itemB)).toBe(true);
    });

    it("in matches any product id in the list", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "in",
            value: ["A", "C"],
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(true);
        expect(evaluator.evaluateAgainst([condition], itemB)).toBe(false);
    });

    it("not_in selects the complement set", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "not_in",
            value: ["A"],
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
        expect(evaluator.evaluateAgainst([condition], itemB)).toBe(true);
    });

    it("contains matches a substring of the item name", () => {
        const condition: RuleCondition = {
            field: "name",
            operator: "contains",
            value: "idg",
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(true);
        expect(evaluator.evaluateAgainst([condition], itemB)).toBe(false);
    });

    it("starts_with matches a name prefix", () => {
        const condition: RuleCondition = {
            field: "name",
            operator: "starts_with",
            value: "Gad",
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
        expect(evaluator.evaluateAgainst([condition], itemB)).toBe(true);
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
        expect(evaluator.evaluateAgainst(group, itemA)).toBe(true);
        expect(evaluator.evaluateAgainst(group, itemB)).toBe(true);
        expect(
            evaluator.evaluateAgainst(group, {
                ...itemB,
                productId: "C",
            })
        ).toBe(false);
    });

    it("negation under a matched-set filter yields the complement, not a cart-wide veto", () => {
        // Mirrors how RuleEngineService uses evaluateAgainst per item: the
        // matched set is every item satisfying the scope, independently.
        const scope: RuleCondition[] = [
            { field: "productId", operator: "not_in", value: ["CHEAP"] },
        ];
        const cart = [
            {
                productId: "CHEAP",
                name: "Loss leader",
                quantity: 1,
                unitPrice: 1,
            },
            {
                productId: "NORMAL",
                name: "Regular",
                quantity: 1,
                unitPrice: 50,
            },
        ];
        const matched = cart.filter((item) =>
            evaluator.evaluateAgainst(scope, item)
        );
        expect(matched).toEqual([cart[1]]);

        const cheapOnlyCart = [cart[0]];
        const matchedCheapOnly = cheapOnlyCart.filter((item) =>
            evaluator.evaluateAgainst(scope, item)
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
    // Order-level `conditions` are not field-allowlisted the way productScope
    // is, and RuleConditionValue accepts arrays, so a malformed payload could
    // hand a scalar/string/comparison operator an array value. These operators
    // must fail closed (never match) rather than silently misbehave: eq/neq
    // via `===`/`!==` against an array (always false/true), or gt/lt/between
    // via `compareValues`'s `String()` coercion into a meaningless
    // lexicographic compare.
    it("neq with an array value returns false, not true", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "neq",
            value: ["A", "B"],
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
    });

    it("eq with an array value returns false", () => {
        const condition: RuleCondition = {
            field: "productId",
            operator: "eq",
            value: ["A"],
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
    });

    it("gt with an array value returns false instead of a lexicographic compare", () => {
        const condition: RuleCondition = {
            field: "unitPrice",
            operator: "gt",
            value: [1],
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
    });

    it("between with an array valueTo returns false", () => {
        const condition: RuleCondition = {
            field: "unitPrice",
            operator: "between",
            value: 1,
            valueTo: [100] as unknown as number,
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
    });

    it("contains with an array value returns false", () => {
        const condition: RuleCondition = {
            field: "name",
            operator: "contains",
            value: ["Widget"],
        };
        expect(evaluator.evaluateAgainst([condition], itemA)).toBe(false);
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
        expect(evaluator.evaluateAgainst([inCondition], itemA)).toBe(true);
        expect(evaluator.evaluateAgainst([notInCondition], itemA)).toBe(true);
    });
});
