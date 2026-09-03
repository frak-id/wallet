import type { SharingPageProduct } from "@frak-labs/core-sdk";
import { describe, expect, it } from "vitest";
import {
    firstRenderableIndex,
    renderableProducts,
    type SharingProducts,
} from "./types";

const shoes: SharingPageProduct = { title: "Shoes", sku: "SHOE-42" };
const socks: SharingPageProduct = { title: "Socks", sku: "SOCK-9" };
const skuOnly: SharingPageProduct = { sku: "HIDDEN-1" };

function products(items: SharingPageProduct[]): SharingProducts {
    return { items, selectedIndex: 0, onSelect: () => {} };
}

describe("renderableProducts", () => {
    it("keeps every titled entry", () => {
        expect(renderableProducts(products([shoes, socks]))).toEqual([
            { product: shoes, index: 0 },
            { product: socks, index: 1 },
        ]);
    });

    it("drops title-less entries so no empty card is drawn", () => {
        expect(renderableProducts(products([skuOnly]))).toEqual([]);
    });

    it("reports the index into the full array, not the filtered one", () => {
        // `selectedIndex` and `rewardProductsForSelection` both index `items`,
        // so renumbering here would select the wrong product.
        expect(renderableProducts(products([skuOnly, shoes, socks]))).toEqual([
            { product: shoes, index: 1 },
            { product: socks, index: 2 },
        ]);
    });

    it("keeps indices aligned when a title-less entry sits between two titled ones", () => {
        expect(renderableProducts(products([shoes, skuOnly, socks]))).toEqual([
            { product: shoes, index: 0 },
            { product: socks, index: 2 },
        ]);
    });

    it("treats a whitespace-only title as not renderable", () => {
        expect(renderableProducts(products([{ title: "   " }]))).toEqual([]);
    });
});

describe("firstRenderableIndex", () => {
    it("skips leading title-less entries", () => {
        expect(firstRenderableIndex([skuOnly, shoes, socks])).toBe(1);
    });

    it("returns 0 when the first entry is renderable", () => {
        expect(firstRenderableIndex([shoes, skuOnly])).toBe(0);
    });

    it("returns undefined when nothing is renderable", () => {
        expect(firstRenderableIndex([skuOnly])).toBeUndefined();
        expect(firstRenderableIndex([])).toBeUndefined();
    });
});
