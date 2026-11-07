import { describe, expect, it } from "vitest";
import { uiLanguage } from "./uiLanguage";

describe("uiLanguage", () => {
    it.each([
        [{ language: "en" }, "en"],
        [{ language: "fr-FR", resolvedLanguage: "en" }, "fr"],
        [{ language: "en-GB" }, "en"],
        [{ language: "EN_us" }, "en"],
    ])("keeps a supported language from %j", (i18n, expected) => {
        expect(uiLanguage(i18n)).toBe(expected);
    });

    it("falls back to the resolved language when the current one is unsupported", () => {
        expect(uiLanguage({ language: "de", resolvedLanguage: "en" })).toBe(
            "en"
        );
    });

    it("never returns a malformed tag", () => {
        expect(uiLanguage({ language: "en_US!!x" })).toBe("en");
        expect(uiLanguage({ language: "!!", resolvedLanguage: "??" })).toBe(
            "fr"
        );
        expect(uiLanguage({})).toBe("fr");
    });
});
