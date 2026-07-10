import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/backendClient", () => ({
    backendBaseUrl: "https://backend.test",
}));

import {
    isValidShopDomain,
    redirectToShopifyAuthorize,
} from "./useShopifySsoRedirect";

describe("isValidShopDomain", () => {
    it("accepts valid myshopify.com domains", () => {
        expect(isValidShopDomain("my-store.myshopify.com")).toBe(true);
        expect(isValidShopDomain("abc123.myshopify.com")).toBe(true);
    });

    it("rejects domains outside myshopify.com", () => {
        expect(isValidShopDomain("evil.com")).toBe(false);
        expect(isValidShopDomain("foo.myshopify.com.evil.com")).toBe(false);
    });

    it("rejects a missing shop segment", () => {
        expect(isValidShopDomain(".myshopify.com")).toBe(false);
    });

    it("rejects an empty string", () => {
        expect(isValidShopDomain("")).toBe(false);
    });

    it("rejects domains containing a space", () => {
        expect(isValidShopDomain("my store.myshopify.com")).toBe(false);
    });

    it("trims whitespace before validating", () => {
        expect(isValidShopDomain("  my-store.myshopify.com  ")).toBe(true);
    });
});

describe("redirectToShopifyAuthorize", () => {
    beforeEach(() => {
        Object.defineProperty(window, "location", {
            value: { href: "https://business.test/login" },
            writable: true,
            configurable: true,
        });
    });

    it("redirects to the backend's Shopify authorize endpoint with the trimmed shop", () => {
        redirectToShopifyAuthorize("  my-store.myshopify.com  ");

        const url = new URL(window.location.href);
        expect(url.origin).toBe("https://backend.test");
        expect(url.pathname).toBe("/business/auth/shopify/authorize");
        expect(url.searchParams.get("shop")).toBe("my-store.myshopify.com");
    });
});
