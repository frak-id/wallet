import { describe, expect, it } from "vitest";
import { matchesShopDomain } from "./shopDomainMatch";

describe("matchesShopDomain", () => {
    it("matches identical domains", () => {
        expect(matchesShopDomain("brand.com", "brand.com")).toBe(true);
    });

    it("matches case-insensitively", () => {
        expect(matchesShopDomain("Brand.com", "brand.COM")).toBe(true);
    });

    it("ignores a leading www.", () => {
        expect(matchesShopDomain("www.brand.com", "brand.com")).toBe(true);
    });

    it("matches when the registering domain is a subdomain of the shop domain", () => {
        expect(matchesShopDomain("shop.brand.com", "brand.com")).toBe(true);
    });

    it("matches when the shop domain is a subdomain of the registering domain (reverse direction)", () => {
        expect(matchesShopDomain("brand.com", "shop.brand.com")).toBe(true);
    });

    it("rejects a bare suffix match that is not on a dot boundary", () => {
        expect(matchesShopDomain("notbrand.com", "brand.com")).toBe(false);
        expect(matchesShopDomain("brand.com", "notbrand.com")).toBe(false);
    });

    it("rejects unrelated domains", () => {
        expect(matchesShopDomain("other.com", "brand.com")).toBe(false);
    });

    it("rejects a bare TLD suffix match", () => {
        expect(matchesShopDomain("evilbrand.com", "com")).toBe(false);
    });
});
