import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";
import type { I18nCustomizations } from "./metafields";
import {
    buildMetafieldValue,
    parseI18nMetafield,
    polishAppearance,
    registerFrakI18nFrTranslations,
    stripEmptyEntries,
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
/*  stripEmptyEntries — guards against persisting empty overrides      */
/* ------------------------------------------------------------------ */

describe("stripEmptyEntries", () => {
    it("returns empty object when input is undefined", () => {
        expect(stripEmptyEntries(undefined)).toEqual({});
    });

    it("returns empty object when input has no keys", () => {
        expect(stripEmptyEntries({})).toEqual({});
    });

    it("drops keys with empty-string values", () => {
        expect(
            stripEmptyEntries({
                "modal.title": "Hello",
                "modal.body": "",
                "modal.cta": "Click",
            })
        ).toEqual({
            "modal.title": "Hello",
            "modal.cta": "Click",
        });
    });

    it("returns empty object when every value is empty", () => {
        expect(
            stripEmptyEntries({
                "modal.title": "",
                "modal.body": "",
            })
        ).toEqual({});
    });

    it("keeps whitespace-only values (still considered an explicit override)", () => {
        expect(stripEmptyEntries({ "modal.title": " " })).toEqual({
            "modal.title": " ",
        });
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

/* ------------------------------------------------------------------ */
/*  FR translation register — INVALID_LOCALE_FOR_SHOP swallow          */
/* ------------------------------------------------------------------ */

describe("registerFrakI18nFrTranslations", () => {
    const translations = [
        { key: "modal.title", value: "Bonjour", digest: "d" },
    ];

    function mockContext(
        userErrors: Array<{ message: string; code?: string }>
    ): AuthenticatedContext {
        const graphql = vi.fn().mockResolvedValue({
            json: async () => ({
                data: { translationsRegister: { userErrors } },
            }),
        });
        return { admin: { graphql } } as unknown as AuthenticatedContext;
    }

    it("treats an all-INVALID_LOCALE_FOR_SHOP rejection as success", async () => {
        const ctx = mockContext([
            {
                message: "locale isn't available",
                code: "INVALID_LOCALE_FOR_SHOP",
            },
        ]);
        expect(
            await registerFrakI18nFrTranslations(
                ctx,
                "gid://entry",
                translations
            )
        ).toBe(true);
    });

    it("fails when a real error is mixed in", async () => {
        const ctx = mockContext([
            {
                message: "locale isn't available",
                code: "INVALID_LOCALE_FOR_SHOP",
            },
            { message: "something else", code: "INVALID_VALUE" },
        ]);
        expect(
            await registerFrakI18nFrTranslations(
                ctx,
                "gid://entry",
                translations
            )
        ).toBe(false);
    });

    it("fails on a non-locale error", async () => {
        const ctx = mockContext([
            { message: "something else", code: "INVALID_VALUE" },
        ]);
        expect(
            await registerFrakI18nFrTranslations(
                ctx,
                "gid://entry",
                translations
            )
        ).toBe(false);
    });

    it("succeeds when there are no user errors", async () => {
        const ctx = mockContext([]);
        expect(
            await registerFrakI18nFrTranslations(
                ctx,
                "gid://entry",
                translations
            )
        ).toBe(true);
    });

    it("no-ops (success) when there are no translations to register", async () => {
        const graphql = vi.fn();
        const ctx = { admin: { graphql } } as unknown as AuthenticatedContext;
        expect(
            await registerFrakI18nFrTranslations(ctx, "gid://entry", [])
        ).toBe(true);
        expect(graphql).not.toHaveBeenCalled();
    });
});
