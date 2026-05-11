import { describe, expect, it } from "vitest";
import { defaultNS, fallbackLng, interpolation, supportedLngs } from "./config";

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
        it("should be fr", () => {
            expect(fallbackLng).toBe("fr");
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
});
