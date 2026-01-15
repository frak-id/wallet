import { describe, expect, it } from "vitest";
import { extractUtmParams } from "./utmParams";

describe("utmParams", () => {
    describe("extractUtmParams", () => {
        it("should extract all UTM parameters from URL", () => {
            const url =
                "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_term=shoes&utm_content=banner";

            const result = extractUtmParams(url);

            expect(result).toEqual({
                source: "google",
                medium: "cpc",
                campaign: "summer",
                term: "shoes",
                content: "banner",
            });
        });

        it("should extract partial UTM parameters", () => {
            const url =
                "https://example.com?utm_source=google&utm_campaign=winter";

            const result = extractUtmParams(url);

            expect(result).toEqual({
                source: "google",
                medium: undefined,
                campaign: "winter",
                term: undefined,
                content: undefined,
            });
        });

        it("should return undefined when no UTM params present", () => {
            const url = "https://example.com?other=value";

            const result = extractUtmParams(url);

            expect(result).toBeUndefined();
        });

        it("should return undefined for empty URL", () => {
            const result = extractUtmParams("");

            expect(result).toBeUndefined();
        });

        it("should handle malformed URLs gracefully", () => {
            const result = extractUtmParams("not-a-valid-url");

            expect(result).toBeUndefined();
        });

        it("should handle URL-encoded values", () => {
            const url =
                "https://example.com?utm_source=google%20ads&utm_campaign=summer%20sale";

            const result = extractUtmParams(url);

            expect(result).toEqual({
                source: "google ads",
                medium: undefined,
                campaign: "summer sale",
                term: undefined,
                content: undefined,
            });
        });

        it("should extract UTM params alongside other query params", () => {
            const url =
                "https://example.com?product=123&utm_source=facebook&ref=abc";

            const result = extractUtmParams(url);

            expect(result).toEqual({
                source: "facebook",
                medium: undefined,
                campaign: undefined,
                term: undefined,
                content: undefined,
            });
        });
    });
});
