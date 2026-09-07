import { beforeEach, describe, expect, it } from "vitest";
import {
    clearConfirmation,
    getSavedConfirmation,
    saveConfirmation,
    sharingConfirmationScope,
} from "./confirmation";

const merchantId = "b7c2e1a4-1111-4111-8111-111111111111";
const clientId = "a3f1c0de-0000-4000-8000-000000000000";

describe("sharingConfirmationScope", () => {
    it("separates two different products for the same sharer", () => {
        // The bug this exists for: shared once, then opened the sheet on
        // something else and landed straight on the success screen.
        const first = sharingConfirmationScope({
            merchantId,
            clientId,
            products: [{ productId: "sku-1", title: "One" }],
        });
        const second = sharingConfirmationScope({
            merchantId,
            clientId,
            products: [{ productId: "sku-2", title: "Two" }],
        });

        expect(first).not.toBe(second);
    });

    it("separates two sharers on the same product", () => {
        expect(
            sharingConfirmationScope({ merchantId, clientId, products: [] })
        ).not.toBe(
            sharingConfirmationScope({
                merchantId,
                clientId: "someone-else",
                products: [],
            })
        );
    });

    it("separates two merchants", () => {
        expect(sharingConfirmationScope({ merchantId, clientId })).not.toBe(
            sharingConfirmationScope({ merchantId: "other", clientId })
        );
    });

    it("is stable across product order", () => {
        const a = { productId: "sku-1", title: "One" };
        const b = { productId: "sku-2", title: "Two" };

        expect(
            sharingConfirmationScope({ merchantId, clientId, products: [a, b] })
        ).toBe(
            sharingConfirmationScope({ merchantId, clientId, products: [b, a] })
        );
    });

    it("ignores quantity and price", () => {
        // A cart whose totals moved is still the same share.
        expect(
            sharingConfirmationScope({
                merchantId,
                clientId,
                products: [{ productId: "sku-1", title: "One", quantity: 1 }],
            })
        ).toBe(
            sharingConfirmationScope({
                merchantId,
                clientId,
                products: [
                    {
                        productId: "sku-1",
                        title: "One",
                        quantity: 4,
                        totalPrice: 79.9,
                    },
                ],
            })
        );
    });

    it("falls back through sku, link and title for an unidentified product", () => {
        const scopes = [
            { sku: "s" },
            { link: "https://acme.example/p" },
            { title: "Just a name" },
        ].map((product) =>
            sharingConfirmationScope({
                merchantId,
                clientId,
                products: [{ title: "", ...product }],
            })
        );

        expect(new Set(scopes).size).toBe(3);
    });

    it("survives a missing merchant and client rather than throwing", () => {
        expect(typeof sharingConfirmationScope({})).toBe("string");
    });
});

describe("saved confirmation", () => {
    const scope = sharingConfirmationScope({ merchantId, clientId });

    beforeEach(() => {
        sessionStorage.clear();
    });

    it("reads back only for the scope it was saved under", () => {
        saveConfirmation(scope);

        expect(getSavedConfirmation(scope)).toBe(true);
        expect(
            getSavedConfirmation(
                sharingConfirmationScope({
                    merchantId,
                    clientId,
                    products: [{ productId: "sku-9", title: "Nine" }],
                })
            )
        ).toBe(false);
    });

    it("expires after the TTL", () => {
        sessionStorage.setItem(
            "frak_sharing_confirmed",
            JSON.stringify({ scope, timestamp: Date.now() - 61 * 60 * 1000 })
        );

        expect(getSavedConfirmation(scope)).toBe(false);
    });

    it("ignores a record written before the scope key existed", () => {
        // Shipped shape was `{ merchantId, timestamp }`; a live session holding
        // one must not read as a confirmation for any scope.
        sessionStorage.setItem(
            "frak_sharing_confirmed",
            JSON.stringify({ merchantId, timestamp: Date.now() })
        );

        expect(getSavedConfirmation(scope)).toBe(false);
    });

    it("ignores a corrupt record", () => {
        sessionStorage.setItem("frak_sharing_confirmed", "not json");

        expect(getSavedConfirmation(scope)).toBe(false);
    });

    it("clears", () => {
        saveConfirmation(scope);
        clearConfirmation();

        expect(getSavedConfirmation(scope)).toBe(false);
    });
});
