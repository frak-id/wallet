import { getSchemaValidator } from "elysia";
import { describe, expect, it } from "vitest";
import { ExplorerConfigSchema, SdkConfigSchema } from "./index";

// Elysia's own validator factory: the same code path that validates request
// bodies at runtime.
const explorerConfig = getSchemaValidator(ExplorerConfigSchema, {});
const sdkConfig = getSchemaValidator(SdkConfigSchema, {});

/**
 * These merchant-authored URLs were previously validated with `format: "uri"`,
 * which accepts any `scheme:` — so every "rejects" payload below used to pass
 * validation and reach an anchor as a live XSS sink.
 */
describe("merchant URL schemas reject script-bearing schemes", () => {
    const dangerous = [
        "javascript:alert(1)",
        "javascript:alert(document.cookie)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "vbscript:msgbox(1)",
    ];

    it.each(dangerous)("ExplorerConfig.logoUrl rejects %s", (logoUrl) => {
        expect(explorerConfig.Check({ logoUrl })).toBe(false);
    });

    it.each(dangerous)("ExplorerConfig.heroImageUrl rejects %s", (url) => {
        expect(explorerConfig.Check({ heroImageUrl: url })).toBe(false);
    });

    it.each(dangerous)("SdkConfig.homepageLink rejects %s", (homepageLink) => {
        expect(sdkConfig.Check({ homepageLink })).toBe(false);
    });

    it("rejects a dangerous entry nested in heroImageUrls", () => {
        expect(
            explorerConfig.Check({
                heroImageUrls: [
                    "https://cdn.gcp.frak.id/ok.webp",
                    "javascript:alert(1)",
                ],
            })
        ).toBe(false);
    });

    it("accepts https URLs", () => {
        expect(
            explorerConfig.Check({
                logoUrl: "https://cdn.gcp.frak.id/logo.webp",
                heroImageUrl: "https://cdn.gcp.frak.id/hero.webp",
                heroImageUrls: ["https://cdn.gcp.frak.id/hero-2.webp"],
            })
        ).toBe(true);
        expect(
            sdkConfig.Check({
                homepageLink: "https://merchant.example.com",
            })
        ).toBe(true);
    });

    // Every consumer of these fields is https, and mixed content would be
    // blocked by the browser.
    it("rejects plain http", () => {
        expect(
            explorerConfig.Check({
                logoUrl: "http://example.com/logo.webp",
            })
        ).toBe(false);
    });

    it("still allows the fields to be omitted or null", () => {
        expect(explorerConfig.Check({})).toBe(true);
        expect(sdkConfig.Check({ homepageLink: null })).toBe(true);
    });
});
