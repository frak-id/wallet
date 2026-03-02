import { describe, expect, it } from "vitest";
import type { I18nCustomizations } from "./metafields";
import {
    buildMetafieldValue,
    parseI18nMetafield,
    polishAppearance,
} from "./metafields";

/**
 * Tests for metafield logic from metafields.ts.
 *
 * The service functions depend on GraphQL, so we extract and test:
 * - i18n customization parsing (flat vs multi-language detection)
 * - buildMetafieldValue logic (storage format selection)
 * - Appearance metafield polishing
 */

/* ------------------------------------------------------------------ */
/*  i18n parsing — mirrors getI18nCustomizations internal logic       */
/* ------------------------------------------------------------------ */

describe("parseI18nMetafield", () => {
    it("returns defaults when value is null", () => {
        expect(parseI18nMetafield(null)).toEqual({ fr: {}, en: {} });
    });

    it("parses flat structure as english-only", () => {
        const flat = { "modal.title": "Hello", "modal.body": "World" };
        const result = parseI18nMetafield(flat);
        expect(result.en).toEqual(flat);
        expect(result.fr).toEqual({});
    });

    it("parses multi-language structure as-is", () => {
        const multi = {
            en: { "modal.title": "Hello" },
            fr: { "modal.title": "Bonjour" },
        };
        const result = parseI18nMetafield(multi);
        expect(result).toEqual(multi);
    });

    it("treats object with only en as multi-language", () => {
        const value = { en: { "modal.title": "Hello" } };
        const result = parseI18nMetafield(value);
        expect(result.en).toEqual({ "modal.title": "Hello" });
        expect(result.fr).toBeUndefined();
    });

    it("treats object with only fr as multi-language", () => {
        const value = { fr: { "modal.title": "Bonjour" } };
        const result = parseI18nMetafield(value);
        expect(result.fr).toEqual({ "modal.title": "Bonjour" });
        expect(result.en).toBeUndefined();
    });

    it("handles empty object as flat structure → defaults to en", () => {
        const result = parseI18nMetafield({});
        expect(result.en).toEqual({});
        expect(result.fr).toEqual({});
    });
});

/* ------------------------------------------------------------------ */
/*  buildMetafieldValue — mirrors the private function                 */
/* ------------------------------------------------------------------ */

describe("buildMetafieldValue", () => {
    it("returns both languages when both have data", () => {
        const customizations: I18nCustomizations = {
            en: { title: "Hello" },
            fr: { title: "Bonjour" },
        };
        const result = buildMetafieldValue(customizations, {
            hasFrenchData: true,
            hasEnglishData: true,
        });
        expect(result).toEqual({
            en: { title: "Hello" },
            fr: { title: "Bonjour" },
        });
    });

    it("returns flat english when only english has data", () => {
        const customizations: I18nCustomizations = {
            en: { title: "Hello" },
            fr: {},
        };
        const result = buildMetafieldValue(customizations, {
            hasFrenchData: false,
            hasEnglishData: true,
        });
        expect(result).toEqual({ title: "Hello" });
    });

    it("returns flat french when only french has data", () => {
        const customizations: I18nCustomizations = {
            en: {},
            fr: { title: "Bonjour" },
        };
        const result = buildMetafieldValue(customizations, {
            hasFrenchData: true,
            hasEnglishData: false,
        });
        expect(result).toEqual({ title: "Bonjour" });
    });

    it("returns empty object when neither has data", () => {
        const customizations: I18nCustomizations = { en: {}, fr: {} };
        const result = buildMetafieldValue(customizations, {
            hasFrenchData: false,
            hasEnglishData: false,
        });
        expect(result).toEqual({});
    });
});

/* ------------------------------------------------------------------ */
/*  Appearance metafield polishing                                     */
/* ------------------------------------------------------------------ */

describe("polishAppearance", () => {
    it("returns appearance when logoUrl is present", () => {
        const appearance = { logoUrl: "https://example.com/logo.png" };
        expect(polishAppearance(appearance)).toEqual(appearance);
    });

    it("returns null when logoUrl is empty string", () => {
        expect(polishAppearance({ logoUrl: "" })).toBeNull();
    });

    it("returns null when logoUrl is undefined", () => {
        expect(polishAppearance({})).toBeNull();
    });
});
