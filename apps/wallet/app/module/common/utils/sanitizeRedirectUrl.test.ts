import { describe, expect, it } from "vitest";
import { isMerchantDomain } from "./sanitizeRedirectUrl";

describe("isMerchantDomain", () => {
    const allowed = ["acme.com", "www.shop.acme.com"];

    it("accepts the merchant's domains, with or without www", () => {
        expect(isMerchantDomain("https://acme.com/return", allowed)).toBe(true);
        expect(isMerchantDomain("https://www.acme.com/", allowed)).toBe(true);
        expect(isMerchantDomain("https://shop.acme.com/", allowed)).toBe(true);
    });

    it("rejects a host that only contains or extends a merchant domain", () => {
        expect(
            isMerchantDomain("https://acme.com.evil.example/", allowed)
        ).toBe(false);
        expect(isMerchantDomain("https://evilacme.com/", allowed)).toBe(false);
        expect(isMerchantDomain("https://eu.acme.com/", allowed)).toBe(false);
    });

    it("rejects a different port than the one registered", () => {
        expect(isMerchantDomain("https://acme.com:8443/", allowed)).toBe(false);
    });

    it("rejects everything when the merchant has no domain", () => {
        expect(isMerchantDomain("https://acme.com/", [])).toBe(false);
    });
});
