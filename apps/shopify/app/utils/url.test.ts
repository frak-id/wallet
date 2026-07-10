import { describe, expect, it } from "vitest";
import { isAbsoluteUrl, parseChargeId } from "./url";

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
