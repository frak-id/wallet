import { describe, expect, it } from "vitest";
import { sumLineAmounts, toPurchaseItem } from "./lineItem";

const baseSource = {
    productId: 42,
    price: "10.00",
    quantity: 2,
    name: "Shoe",
    title: "Shoe",
};

describe("toPurchaseItem", () => {
    describe("item uniqueness key", () => {
        it("separates two variants of one product by sku", () => {
            const small = toPurchaseItem({ ...baseSource, sku: "A-S" });
            const medium = toPurchaseItem({ ...baseSource, sku: "A-M" });

            expect(small.externalId).toBe(medium.externalId);
            expect(small.sku).not.toBe(medium.sku);
        });

        it("keeps the parent product id on external_id", () => {
            expect(
                toPurchaseItem({ ...baseSource, sku: "A-S" }).externalId
            ).toBe("42");
        });
    });

    describe("value coercion — both claim paths must agree", () => {
        it("stringifies a numeric sku so it matches the varchar the late-claim path reads", () => {
            expect(toPurchaseItem({ ...baseSource, sku: 12345 }).sku).toBe(
                "12345"
            );
        });

        it("numbers a string quantity", () => {
            expect(
                toPurchaseItem({ ...baseSource, quantity: "3" }).quantity
            ).toBe(3);
        });

        it("drops an empty sku rather than storing an empty string", () => {
            // "" satisfies `exists`, `neq` and `not_in`, so it would join a
            // negated scope's matched set where an absent sku does not.
            expect(
                toPurchaseItem({ ...baseSource, sku: "   " }).sku
            ).toBeNull();
            expect(toPurchaseItem({ ...baseSource, sku: "" }).sku).toBeNull();
        });

        it("trims a padded sku", () => {
            expect(toPurchaseItem({ ...baseSource, sku: " A-S " }).sku).toBe(
                "A-S"
            );
        });

        it("drops a non-finite quantity instead of persisting NaN", () => {
            expect(
                toPurchaseItem({ ...baseSource, quantity: "abc" }).quantity
            ).toBe(0);
        });
    });

    describe("totalPrice", () => {
        it("stores the supplied line total", () => {
            expect(
                toPurchaseItem({ ...baseSource, totalPrice: "14.00" })
                    .totalPrice
            ).toBe("14");
        });

        it("is null when the provider sends none, so the reader falls back", () => {
            expect(toPurchaseItem(baseSource).totalPrice).toBeNull();
        });
    });
});

describe("sumLineAmounts", () => {
    it("sums a discount_allocations-shaped array", () => {
        expect(sumLineAmounts([{ amount: "3.00" }, { amount: "1.50" }])).toBe(
            4.5
        );
    });

    it("sums a tax_lines-shaped array", () => {
        expect(sumLineAmounts([{ price: "2.00" }, { price: "0.40" }])).toBe(
            2.4
        );
    });

    it("skips unparseable entries rather than poisoning the sum with NaN", () => {
        expect(sumLineAmounts([{ amount: "3.00" }, { amount: "oops" }])).toBe(
            3
        );
    });

    it("is zero when the provider omits the array", () => {
        expect(sumLineAmounts(undefined)).toBe(0);
    });
});
