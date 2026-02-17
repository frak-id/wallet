import { describe, expect, it } from "vitest";
import {
    buildCampaignLink,
    buildWebhookLink,
    isAbsoluteUrl,
    parseChargeId,
    validateMintParams,
} from "./url";

/**
 * Tests for URL utility functions extracted from routes and hooks.
 */

/* ------------------------------------------------------------------ */
/*  isAbsoluteUrl                                                      */
/* ------------------------------------------------------------------ */

describe("isAbsoluteUrl", () => {
    it("returns true for https URLs", () => {
        expect(isAbsoluteUrl("https://example.com")).toBe(true);
    });

    it("returns true for http URLs", () => {
        expect(isAbsoluteUrl("http://example.com")).toBe(true);
    });

    it("returns true for mailto links", () => {
        expect(isAbsoluteUrl("mailto:hello@frak-labs.com")).toBe(true);
    });

    it("returns true for tel links", () => {
        expect(isAbsoluteUrl("tel:+1234567890")).toBe(true);
    });

    it("returns false for relative paths", () => {
        expect(isAbsoluteUrl("/app/settings")).toBe(false);
    });

    it("returns false for hash links", () => {
        expect(isAbsoluteUrl("#section")).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(isAbsoluteUrl("")).toBe(false);
    });

    it("returns false for plain text", () => {
        expect(isAbsoluteUrl("not-a-url")).toBe(false);
    });

    it("returns false for protocol-relative URLs", () => {
        expect(isAbsoluteUrl("//example.com")).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/*  parseChargeId                                                      */
/* ------------------------------------------------------------------ */

describe("parseChargeId", () => {
    it("parses valid numeric string", () => {
        expect(parseChargeId("12345")).toBe(12345);
    });

    it("returns null for null input", () => {
        expect(parseChargeId(null)).toBeNull();
    });

    it("returns null for non-numeric string", () => {
        expect(parseChargeId("abc")).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(parseChargeId("")).toBeNull();
    });

    it("parses string with trailing non-numeric chars (parseInt behavior)", () => {
        expect(parseChargeId("123abc")).toBe(123);
    });

    it("handles large numbers", () => {
        expect(parseChargeId("9999999999")).toBe(9999999999);
    });
});

/* ------------------------------------------------------------------ */
/*  validateMintParams                                                 */
/* ------------------------------------------------------------------ */

describe("validateMintParams", () => {
    it("accepts valid ethereum address", () => {
        const result = validateMintParams(
            "0x1234567890abcdef1234567890abcdef12345678"
        );
        expect(result.valid).toBe(true);
    });

    it("rejects null wallet address", () => {
        const result = validateMintParams(null);
        expect(result).toEqual({
            valid: false,
            error: "Missing wallet address",
        });
    });

    it("rejects invalid wallet address", () => {
        const result = validateMintParams("not-an-address");
        expect(result).toEqual({
            valid: false,
            error: "Invalid wallet address",
        });
    });

    it("rejects too-short hex string", () => {
        const result = validateMintParams("0x1234");
        expect(result).toEqual({
            valid: false,
            error: "Invalid wallet address",
        });
    });

    it("accepts checksummed address", () => {
        const result = validateMintParams(
            "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
        );
        expect(result.valid).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/*  buildCampaignLink                                                  */
/* ------------------------------------------------------------------ */

describe("buildCampaignLink", () => {
    it("builds URL with all parameters", () => {
        const url = buildCampaignLink({
            businessUrl: "https://business.frak.id",
            name: "Summer Campaign",
            bankId: "0xabc",
            domain: "shop.example.com",
            globalBudget: 1000,
            rawCAC: 5,
            ratio: 0.3,
            preferredCurrency: "eur",
            merchantId: "1312",
        });
        const parsed = new URL(url);
        expect(parsed.pathname).toBe("/embedded/create-campaign");
        expect(parsed.searchParams.get("n")).toBe("Summer Campaign");
        expect(parsed.searchParams.get("bid")).toBe("0xabc");
        expect(parsed.searchParams.get("d")).toBe("shop.example.com");
        expect(parsed.searchParams.get("gb")).toBe("1000");
        expect(parsed.searchParams.get("cac")).toBe("5");
        expect(parsed.searchParams.get("r")).toBe("0.3");
        expect(parsed.searchParams.get("sc")).toBe("eur");
        expect(parsed.searchParams.get("mid")).toBe("1312");
    });

    it("omits currency param when not provided", () => {
        const url = buildCampaignLink({
            businessUrl: "https://business.frak.id",
            name: "Test",
            bankId: "0x1",
            domain: "test.com",
            globalBudget: 100,
            rawCAC: 1,
            ratio: 0.5,
            merchantId: "1312",
        });
        const parsed = new URL(url);
        expect(parsed.searchParams.has("sc")).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/*  buildWebhookLink                                                   */
/* ------------------------------------------------------------------ */

describe("buildWebhookLink", () => {
    it("builds correct URL with merchant ID", () => {
        const url = buildWebhookLink("https://business.frak.id", "0xabc123");
        const parsed = new URL(url);
        expect(parsed.pathname).toBe("/embedded/purchase-tracker");
        expect(parsed.searchParams.get("mid")).toBe("0xabc123");
    });

    it("handles dev URL", () => {
        const url = buildWebhookLink("https://business-dev.frak.id", "0xdef");
        expect(url).toContain("business-dev.frak.id");
        expect(url).toContain("mid=0xdef");
    });
});
