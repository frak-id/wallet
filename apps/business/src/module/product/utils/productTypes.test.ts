import { productTypesMask } from "@frak-labs/core-sdk";
import { describe, expect, it } from "vitest";
import {
    decodeProductTypesMask,
    encodeProductTypesMask,
    productTypesLabel,
} from "./productTypes";

describe("productTypes", () => {
    describe("decodeProductTypesMask", () => {
        it("should decode single product type", () => {
            const webshopMask = productTypesMask.webshop;
            const result = decodeProductTypesMask(webshopMask);
            expect(result).toEqual(["webshop"]);
        });

        it("should decode multiple product types", () => {
            const combinedMask =
                productTypesMask.webshop | productTypesMask.press;
            const result = decodeProductTypesMask(combinedMask);
            expect(result).toContain("webshop");
            expect(result).toContain("press");
            expect(result).toHaveLength(2);
        });

        it("should decode all product types", () => {
            const allMask =
                productTypesMask.webshop |
                productTypesMask.press |
                productTypesMask.dapp |
                productTypesMask.retail |
                productTypesMask.referral |
                productTypesMask.purchase;

            const result = decodeProductTypesMask(allMask);
            expect(result).toHaveLength(6);
            expect(result).toContain("webshop");
            expect(result).toContain("press");
            expect(result).toContain("dapp");
            expect(result).toContain("retail");
            expect(result).toContain("referral");
            expect(result).toContain("purchase");
        });

        it("should return empty array for zero mask", () => {
            const result = decodeProductTypesMask(0n);
            expect(result).toEqual([]);
        });

        it("should decode press type", () => {
            const pressMask = productTypesMask.press;
            const result = decodeProductTypesMask(pressMask);
            expect(result).toEqual(["press"]);
        });

        it("should decode dapp type", () => {
            const dappMask = productTypesMask.dapp;
            const result = decodeProductTypesMask(dappMask);
            expect(result).toEqual(["dapp"]);
        });

        it("should decode retail type", () => {
            const retailMask = productTypesMask.retail;
            const result = decodeProductTypesMask(retailMask);
            expect(result).toEqual(["retail"]);
        });

        it("should decode referral type", () => {
            const referralMask = productTypesMask.referral;
            const result = decodeProductTypesMask(referralMask);
            expect(result).toEqual(["referral"]);
        });

        it("should decode purchase type", () => {
            const purchaseMask = productTypesMask.purchase;
            const result = decodeProductTypesMask(purchaseMask);
            expect(result).toEqual(["purchase"]);
        });
    });

    describe("encodeProductTypesMask", () => {
        it("should encode single product type", () => {
            const result = encodeProductTypesMask(["webshop"]);
            expect(result).toBe(productTypesMask.webshop);
        });

        it("should encode multiple product types", () => {
            const result = encodeProductTypesMask(["webshop", "press"]);
            const expected = productTypesMask.webshop | productTypesMask.press;
            expect(result).toBe(expected);
        });

        it("should encode all product types", () => {
            const result = encodeProductTypesMask([
                "webshop",
                "press",
                "dapp",
                "retail",
                "referral",
                "purchase",
            ]);

            const expected =
                productTypesMask.webshop |
                productTypesMask.press |
                productTypesMask.dapp |
                productTypesMask.retail |
                productTypesMask.referral |
                productTypesMask.purchase;

            expect(result).toBe(expected);
        });

        it("should return 0 for empty array", () => {
            const result = encodeProductTypesMask([]);
            expect(result).toBe(0n);
        });

        it("should be idempotent with decode", () => {
            const types = ["webshop", "press", "dapp"];
            const encoded = encodeProductTypesMask(types as any);
            const decoded = decodeProductTypesMask(encoded);

            expect(decoded.sort()).toEqual(types.sort());
        });

        it("should handle single types correctly", () => {
            const types = ["press", "dapp", "retail", "referral", "purchase"];

            for (const type of types) {
                const encoded = encodeProductTypesMask([type as any]);
                const decoded = decodeProductTypesMask(encoded);
                expect(decoded).toEqual([type]);
            }
        });
    });

    describe("encode/decode round trip", () => {
        it("should maintain data integrity through encode-decode cycle", () => {
            const originalTypes = ["webshop", "press"];
            const encoded = encodeProductTypesMask(originalTypes as any);
            const decoded = decodeProductTypesMask(encoded);

            expect(decoded.sort()).toEqual(originalTypes.sort());
        });

        it("should handle all combinations", () => {
            const combinations = [
                ["webshop"],
                ["press"],
                ["dapp"],
                ["webshop", "press"],
                ["webshop", "dapp"],
                ["press", "dapp"],
                ["webshop", "press", "dapp"],
            ];

            for (const combo of combinations) {
                const encoded = encodeProductTypesMask(combo as any);
                const decoded = decodeProductTypesMask(encoded);
                expect(decoded.sort()).toEqual(combo.sort());
            }
        });
    });

    describe("productTypesLabel", () => {
        it("should have label for all product types", () => {
            expect(productTypesLabel.dapp).toBeDefined();
            expect(productTypesLabel.press).toBeDefined();
            expect(productTypesLabel.webshop).toBeDefined();
            expect(productTypesLabel.retail).toBeDefined();
            expect(productTypesLabel.referral).toBeDefined();
            expect(productTypesLabel.purchase).toBeDefined();
        });

        it("should have name and description for each type", () => {
            for (const [_key, label] of Object.entries(productTypesLabel)) {
                expect(label.name).toBeTruthy();
                expect(label.description).toBeTruthy();
                expect(typeof label.name).toBe("string");
                expect(typeof label.description).toBe("string");
            }
        });

        it("should have exactly 6 product types", () => {
            const keys = Object.keys(productTypesLabel);
            expect(keys).toHaveLength(6);
        });

        it("should have unique names", () => {
            const names = Object.values(productTypesLabel).map(
                (label) => label.name
            );
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });

        it("should have non-empty descriptions", () => {
            for (const label of Object.values(productTypesLabel)) {
                expect(label.description.length).toBeGreaterThan(10);
            }
        });

        it("should have correct labels for each type", () => {
            expect(productTypesLabel.dapp.name).toBe("Dapp");
            expect(productTypesLabel.press.name).toBe("Press");
            expect(productTypesLabel.webshop.name).toBe("WebShop");
            expect(productTypesLabel.retail.name).toBe("Retail");
            expect(productTypesLabel.referral.name).toBe("Referral");
            expect(productTypesLabel.purchase.name).toBe("Purchase");
        });
    });
});
