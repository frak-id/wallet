import { describe, expect, it } from "vitest";
import { defaultNS, fallbackLng, interpolation, supportedLngs } from "./config";

describe("i18n config", () => {
    it("supports en and fr, in that order", () => {
        expect(supportedLngs).toEqual(["en", "fr"]);
    });

    it("falls back to a supported language", () => {
        expect(fallbackLng).toBe("fr");
        expect(supportedLngs).toContain(fallbackLng);
    });

    it("defaults to the translation namespace", () => {
        expect(defaultNS).toBe("translation");
    });

    it("leaves interpolation unescaped (react already escapes)", () => {
        expect(interpolation.escapeValue).toBe(false);
    });
});
