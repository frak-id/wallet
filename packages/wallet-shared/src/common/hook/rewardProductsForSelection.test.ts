import type { SharingPageProduct } from "@frak-labs/core-sdk";
import { describe, expect, it } from "vitest";
import { rewardProductsForSelection } from "./rewardProductsForSelection";

const shoes: SharingPageProduct = { title: "Shoes", sku: "SHOE-42" };
const socks: SharingPageProduct = { title: "Socks", sku: "SOCK-9" };

describe("rewardProductsForSelection", () => {
    it("returns undefined when there is nothing to select from", () => {
        // undefined rather than [] so the caller reproduces the exact
        // "no product context" ranking that predates product scoping.
        expect(rewardProductsForSelection(undefined, 0)).toBeUndefined();
        expect(rewardProductsForSelection([], 0)).toBeUndefined();
    });

    it("narrows to the selected product", () => {
        const products = [shoes, socks];
        expect(rewardProductsForSelection(products, 1)).toEqual([socks]);
    });

    it("falls back to the full list when no product is selected", () => {
        const products = [shoes, socks];
        expect(rewardProductsForSelection(products, undefined)).toEqual(
            products
        );
    });

    it("falls back to the full list when the index resolves to nothing", () => {
        // Guards against advertising nothing when a stale index outlives the
        // list it pointed into (e.g. the products prop changed underneath).
        const products = [shoes];
        expect(rewardProductsForSelection(products, 5)).toEqual(products);
        expect(rewardProductsForSelection(products, -1)).toEqual(products);
    });

    it("passes the caller's array through by reference on the full-list path", () => {
        // The result feeds a react-query `select`, so the no-selection path
        // must not manufacture a new array identity on every call.
        const products = [shoes, socks];
        expect(rewardProductsForSelection(products, undefined)).toBe(products);
    });
});
