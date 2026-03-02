import { describe, expect, it } from "vitest";
import { extractUtmParams } from "./utmParams";

describe("extractUtmParams", () => {
    it("should return undefined when url is undefined", () => {
        const result = extractUtmParams(undefined);
        expect(result).toBeUndefined();
    });

    it("should return undefined when url is empty string", () => {
        const result = extractUtmParams("");
        expect(result).toBeUndefined();
    });

    it("should return undefined when URL has no UTM params", () => {
        const result = extractUtmParams("https://example.com");
        expect(result).toBeUndefined();
    });

    it("should return undefined when URL has only non-UTM query params", () => {
        const result = extractUtmParams("https://example.com?foo=bar&baz=qux");
        expect(result).toBeUndefined();
    });

    it("should return undefined when URL is invalid", () => {
        const result = extractUtmParams("not a valid url");
        expect(result).toBeUndefined();
    });

    it("should extract utm_source", () => {
        const result = extractUtmParams(
            "https://example.com?utm_source=google"
        );
        expect(result).toEqual({
            source: "google",
            medium: undefined,
            campaign: undefined,
            term: undefined,
            content: undefined,
        });
    });

    it("should extract utm_medium", () => {
        const result = extractUtmParams("https://example.com?utm_medium=cpc");
        expect(result).toEqual({
            source: undefined,
            medium: "cpc",
            campaign: undefined,
            term: undefined,
            content: undefined,
        });
    });

    it("should extract utm_campaign", () => {
        const result = extractUtmParams(
            "https://example.com?utm_campaign=summer_sale"
        );
        expect(result).toEqual({
            source: undefined,
            medium: undefined,
            campaign: "summer_sale",
            term: undefined,
            content: undefined,
        });
    });

    it("should extract utm_term", () => {
        const result = extractUtmParams("https://example.com?utm_term=wallet");
        expect(result).toEqual({
            source: undefined,
            medium: undefined,
            campaign: undefined,
            term: "wallet",
            content: undefined,
        });
    });

    it("should extract utm_content", () => {
        const result = extractUtmParams(
            "https://example.com?utm_content=banner"
        );
        expect(result).toEqual({
            source: undefined,
            medium: undefined,
            campaign: undefined,
            term: undefined,
            content: "banner",
        });
    });

    it("should extract all UTM params together", () => {
        const result = extractUtmParams(
            "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_term=wallet&utm_content=banner"
        );
        expect(result).toEqual({
            source: "google",
            medium: "cpc",
            campaign: "summer",
            term: "wallet",
            content: "banner",
        });
    });

    it("should handle URL with other query params mixed in", () => {
        const result = extractUtmParams(
            "https://example.com?foo=bar&utm_source=google&baz=qux&utm_campaign=summer&other=value"
        );
        expect(result).toEqual({
            source: "google",
            medium: undefined,
            campaign: "summer",
            term: undefined,
            content: undefined,
        });
    });

    it("should handle URL with only one UTM param", () => {
        const result = extractUtmParams(
            "https://example.com?utm_source=facebook"
        );
        expect(result).toEqual({
            source: "facebook",
            medium: undefined,
            campaign: undefined,
            term: undefined,
            content: undefined,
        });
    });

    it("should handle URL with fragment and UTM params", () => {
        const result = extractUtmParams(
            "https://example.com?utm_source=twitter&utm_medium=social#section"
        );
        expect(result).toEqual({
            source: "twitter",
            medium: "social",
            campaign: undefined,
            term: undefined,
            content: undefined,
        });
    });

    it("should handle URL with encoded special characters in UTM values", () => {
        const result = extractUtmParams(
            "https://example.com?utm_source=google&utm_campaign=summer%20sale"
        );
        expect(result).toEqual({
            source: "google",
            medium: undefined,
            campaign: "summer sale",
            term: undefined,
            content: undefined,
        });
    });

    it("should handle URL with empty UTM param values", () => {
        const result = extractUtmParams(
            "https://example.com?utm_source=&utm_medium=cpc"
        );
        expect(result).toEqual({
            source: "",
            medium: "cpc",
            campaign: undefined,
            term: undefined,
            content: undefined,
        });
    });
});
