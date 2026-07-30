import { describe, expect, it } from "vitest";
import { isRenderableUrl, isValidUrl, normalizeUrl, validateUrl } from "./url";

describe("normalizeUrl", () => {
    it("leaves empty untouched", () => {
        expect(normalizeUrl("")).toBe("");
        expect(normalizeUrl("   ")).toBe("");
    });

    it("prepends https:// to a scheme-less host", () => {
        expect(normalizeUrl("example.com")).toBe("https://example.com");
    });

    it("leaves an existing http(s) scheme untouched", () => {
        expect(normalizeUrl("https://example.com")).toBe("https://example.com");
        expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    });

    it("trims surrounding whitespace before normalizing", () => {
        expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
    });
});

describe("isValidUrl", () => {
    it("allows an empty value (optional field)", () => {
        expect(isValidUrl("")).toBe(true);
        expect(isValidUrl("   ")).toBe(true);
    });

    it("accepts a valid https URL", () => {
        expect(isValidUrl("https://example.com/logo.png")).toBe(true);
    });

    it("accepts a scheme-less host by normalizing first", () => {
        expect(isValidUrl("example.com")).toBe(true);
    });

    it("rejects a URL longer than 2048 characters", () => {
        const longUrl = `https://example.com/${"a".repeat(2048)}`;
        expect(longUrl.length).toBeGreaterThan(2048);
        expect(isValidUrl(longUrl)).toBe(false);
    });

    it("rejects a value with no host", () => {
        // `https://` with no authority fails `new URL()` parsing.
        expect(isValidUrl("https://")).toBe(false);
    });

    it("rejects a non-http(s) scheme", () => {
        expect(isValidUrl("ftp://example.com")).toBe(false);
        expect(isValidUrl("mailto:foo@example.com")).toBe(false);
        expect(isValidUrl("javascript:alert(1)")).toBe(false);
        expect(isValidUrl("data:text/html,<script>")).toBe(false);
    });

    it("accepts an explicit http(s) scheme", () => {
        expect(isValidUrl("http://example.com")).toBe(true);
        expect(isValidUrl("https://example.com")).toBe(true);
    });

    it("rejects an unparseable URL", () => {
        expect(isValidUrl("not a url")).toBe(false);
    });
});

describe("isRenderableUrl", () => {
    it("accepts http(s) URLs", () => {
        expect(isRenderableUrl("https://example.com/a.png")).toBe(true);
        expect(isRenderableUrl("http://example.com")).toBe(true);
    });

    // The whole reason this helper exists: the backend's historic
    // `format: "uri"` validation accepts every one of these.
    it("rejects script-bearing schemes", () => {
        expect(isRenderableUrl("javascript:alert(1)")).toBe(false);
        expect(isRenderableUrl("javascript:alert(document.cookie)")).toBe(
            false
        );
        expect(isRenderableUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(
            false
        );
        expect(isRenderableUrl("vbscript:msgbox(1)")).toBe(false);
    });

    it("rejects other non-renderable schemes", () => {
        expect(isRenderableUrl("ftp://example.com")).toBe(false);
        expect(isRenderableUrl("mailto:foo@example.com")).toBe(false);
    });

    it("rejects empty, nullish and unparseable values", () => {
        expect(isRenderableUrl(undefined)).toBe(false);
        expect(isRenderableUrl(null)).toBe(false);
        expect(isRenderableUrl("")).toBe(false);
        expect(isRenderableUrl("not a url")).toBe(false);
        // Unlike `isValidUrl`, no normalization: a scheme-less host is not
        // something we can safely render as-is.
        expect(isRenderableUrl("example.com")).toBe(false);
    });
});

describe("validateUrl", () => {
    it("accepts a dotted domain with or without scheme", () => {
        expect(validateUrl("example.com")).toBe(true);
        expect(validateUrl("https://example.com")).toBe(true);
        expect(validateUrl("www.example.com")).toBe(true);
    });

    it("rejects a value without a dotted domain", () => {
        expect(validateUrl("not-a-domain")).toBe(false);
        expect(validateUrl("")).toBe(false);
    });
});
