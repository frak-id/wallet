import { describe, expect, it } from "../../tests/vitest-fixtures";
import { mergeAttribution } from "./mergeAttribution";

describe("mergeAttribution", () => {
    describe("explicit disable", () => {
        it("returns undefined when perCall is null", () => {
            expect(
                mergeAttribution({
                    perCall: null,
                    defaults: { utmSource: "brand" },
                    productUtmContent: "product-123",
                })
            ).toBeUndefined();
        });
    });

    describe("no inputs", () => {
        it("returns undefined when all layers are empty", () => {
            expect(mergeAttribution({ perCall: undefined })).toBeUndefined();
        });

        it("returns undefined when perCall is undefined and defaults is empty object", () => {
            expect(
                mergeAttribution({ perCall: undefined, defaults: {} })
            ).toBeUndefined();
        });
    });

    describe("defaults only", () => {
        it("returns defaults when perCall is undefined", () => {
            expect(
                mergeAttribution({
                    perCall: undefined,
                    defaults: {
                        utmSource: "brand",
                        utmMedium: "newsletter",
                    },
                })
            ).toEqual({
                utmSource: "brand",
                utmMedium: "newsletter",
            });
        });
    });

    describe("perCall only", () => {
        it("returns perCall when defaults is undefined", () => {
            expect(
                mergeAttribution({
                    perCall: { utmSource: "custom", utmContent: "hero" },
                })
            ).toEqual({
                utmSource: "custom",
                utmContent: "hero",
            });
        });

        it("returns empty object when perCall is empty and no defaults", () => {
            // perCall: {} signals \"apply attribution with hardcoded defaults downstream\"
            expect(mergeAttribution({ perCall: {} })).toEqual({});
        });
    });

    describe("per-field merge (perCall wins over defaults)", () => {
        it("merges perCall over defaults field-by-field", () => {
            expect(
                mergeAttribution({
                    perCall: { utmMedium: "email" },
                    defaults: {
                        utmSource: "brand",
                        utmMedium: "newsletter",
                        utmCampaign: "spring",
                    },
                })
            ).toEqual({
                utmSource: "brand",
                utmMedium: "email",
                utmCampaign: "spring",
            });
        });

        it("lets perCall override every default field", () => {
            expect(
                mergeAttribution({
                    perCall: {
                        utmSource: "pc-src",
                        utmMedium: "pc-med",
                        utmCampaign: "pc-camp",
                        utmTerm: "pc-term",
                        via: "pc-via",
                        ref: "pc-ref",
                    },
                    defaults: {
                        utmSource: "def-src",
                        utmMedium: "def-med",
                        utmCampaign: "def-camp",
                        utmTerm: "def-term",
                        via: "def-via",
                        ref: "def-ref",
                    },
                })
            ).toEqual({
                utmSource: "pc-src",
                utmMedium: "pc-med",
                utmCampaign: "pc-camp",
                utmTerm: "pc-term",
                via: "pc-via",
                ref: "pc-ref",
            });
        });
    });

    describe("utm_content handling", () => {
        it("uses productUtmContent when provided", () => {
            expect(
                mergeAttribution({
                    perCall: { utmContent: "fallback" },
                    productUtmContent: "product-42",
                })
            ).toEqual({ utmContent: "product-42" });
        });

        it("falls back to perCall.utmContent when productUtmContent is absent", () => {
            expect(
                mergeAttribution({
                    perCall: { utmContent: "fallback" },
                })
            ).toEqual({ utmContent: "fallback" });
        });

        it("never inherits utm_content from defaults (shape excludes it)", () => {
            // Even if a backend/SDK config erroneously contained utm_content
            // at runtime, the merged result must not carry it.
            expect(
                mergeAttribution({
                    perCall: {},
                    // @ts-expect-error — defaults typing disallows utmContent,
                    // but we simulate runtime data coming from a loose source.
                    defaults: { utmContent: "should-not-leak" },
                })
            ).toEqual({});
        });

        it("adds attribution solely to carry a productUtmContent", () => {
            expect(
                mergeAttribution({
                    perCall: undefined,
                    productUtmContent: "product-7",
                })
            ).toEqual({ utmContent: "product-7" });
        });
    });
});
