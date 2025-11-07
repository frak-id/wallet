import { describe, expect, it } from "vitest";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    resources,
    supportedLngs,
} from "./config";

describe("i18n config", () => {
    describe("supportedLngs", () => {
        it("should be an array", () => {
            expect(Array.isArray(supportedLngs)).toBe(true);
        });

        it("should contain en and fr", () => {
            expect(supportedLngs).toContain("en");
            expect(supportedLngs).toContain("fr");
        });

        it("should have exactly 2 languages", () => {
            expect(supportedLngs).toHaveLength(2);
        });

        it("should have en and fr in order", () => {
            expect(supportedLngs[0]).toBe("en");
            expect(supportedLngs[1]).toBe("fr");
        });
    });

    describe("fallbackLng", () => {
        it("should be en", () => {
            expect(fallbackLng).toBe("en");
        });

        it("should be a string", () => {
            expect(typeof fallbackLng).toBe("string");
        });

        it("should be in supported languages", () => {
            expect(supportedLngs).toContain(fallbackLng);
        });
    });

    describe("defaultNS", () => {
        it("should be translation", () => {
            expect(defaultNS).toBe("translation");
        });

        it("should be a string", () => {
            expect(typeof defaultNS).toBe("string");
        });
    });

    describe("resources", () => {
        it("should be an object", () => {
            expect(typeof resources).toBe("object");
            expect(resources).not.toBeNull();
        });

        it("should have en and fr keys", () => {
            expect(resources).toHaveProperty("en");
            expect(resources).toHaveProperty("fr");
        });

        it("should have translation namespace for each language", () => {
            expect(resources.en).toHaveProperty("translation");
            expect(resources.fr).toHaveProperty("translation");
        });

        it("should have customized namespace for each language", () => {
            expect(resources.en).toHaveProperty("customized");
            expect(resources.fr).toHaveProperty("customized");
        });

        it("should have valid translation objects", () => {
            expect(typeof resources.en.translation).toBe("object");
            expect(typeof resources.fr.translation).toBe("object");
        });

        it("should have valid customized objects", () => {
            expect(typeof resources.en.customized).toBe("object");
            expect(typeof resources.fr.customized).toBe("object");
        });

        it("should have non-empty translation objects", () => {
            expect(
                Object.keys(resources.en.translation).length
            ).toBeGreaterThan(0);
            expect(
                Object.keys(resources.fr.translation).length
            ).toBeGreaterThan(0);
        });
    });

    describe("interpolation", () => {
        it("should be an object", () => {
            expect(typeof interpolation).toBe("object");
            expect(interpolation).not.toBeNull();
        });

        it("should have escapeValue property", () => {
            expect(interpolation).toHaveProperty("escapeValue");
        });

        it("should have escapeValue set to false", () => {
            expect(interpolation.escapeValue).toBe(false);
        });
    });

    describe("configuration consistency", () => {
        it("should have resources for all supported languages", () => {
            for (const lang of supportedLngs) {
                expect(resources).toHaveProperty(lang);
            }
        });

        it("should have same namespaces for all languages", () => {
            const enNamespaces = Object.keys(resources.en);
            const frNamespaces = Object.keys(resources.fr);

            expect(enNamespaces.sort()).toEqual(frNamespaces.sort());
        });

        it("should include defaultNS in all language resources", () => {
            expect(resources.en).toHaveProperty(defaultNS);
            expect(resources.fr).toHaveProperty(defaultNS);
        });
    });
});
