import { describe, expect, it } from "vitest";
import { sanitizeShareImage } from "./sanitizeShareImage";

describe("sanitizeShareImage", () => {
    it("accepts a plain https URL", () => {
        expect(sanitizeShareImage("https://cdn.example.com/logo.png")).toBe(
            "https://cdn.example.com/logo.png"
        );
    });

    it("keeps the query string, unlike sanitizeRedirectUrl", () => {
        const url = "https://cdn.example.com/logo.png?sig=abc123&exp=999";
        expect(sanitizeShareImage(url)).toBe(url);
    });

    it("rejects non-https protocols", () => {
        expect(
            sanitizeShareImage("http://cdn.example.com/logo.png")
        ).toBeUndefined();
        expect(sanitizeShareImage("javascript:alert(1)")).toBeUndefined();
        expect(
            sanitizeShareImage("data:image/png;base64,AAAA")
        ).toBeUndefined();
    });

    it("rejects embedded credentials", () => {
        expect(
            sanitizeShareImage("https://user:pass@cdn.example.com/logo.png")
        ).toBeUndefined();
        expect(
            sanitizeShareImage("https://user@cdn.example.com/logo.png")
        ).toBeUndefined();
    });

    it("rejects values over the length cap", () => {
        const long = `https://cdn.example.com/${"a".repeat(500)}.png`;
        expect(long.length).toBeGreaterThan(512);
        expect(sanitizeShareImage(long)).toBeUndefined();
    });

    it("rejects malformed and non-string input", () => {
        expect(sanitizeShareImage("not a url")).toBeUndefined();
        expect(sanitizeShareImage(undefined)).toBeUndefined();
        expect(sanitizeShareImage(42)).toBeUndefined();
        expect(sanitizeShareImage("")).toBeUndefined();
    });
});
