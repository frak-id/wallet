import { afterEach, describe, expect, it } from "vitest";
import { detectPageLanguage } from "./detectPageLanguage";

function setBrowserLanguage(value: string | undefined) {
    Object.defineProperty(navigator, "language", {
        value,
        configurable: true,
    });
}

function setHtmlLang(value: string) {
    document.documentElement.lang = value;
}

describe.sequential("detectPageLanguage", () => {
    afterEach(() => {
        setBrowserLanguage("en-US");
        setHtmlLang("");
    });

    it("prefers the page <html lang> over the browser language", () => {
        setBrowserLanguage("en-US");
        setHtmlLang("fr-FR");
        expect(detectPageLanguage()).toBe("fr");
    });

    it("falls back to the browser language when <html lang> is unset", () => {
        setHtmlLang("");
        setBrowserLanguage("fr-FR");
        expect(detectPageLanguage()).toBe("fr");
    });

    it("returns undefined for unsupported languages", () => {
        setHtmlLang("de");
        setBrowserLanguage("de-DE");
        expect(detectPageLanguage()).toBeUndefined();
    });

    it("ignores an unsupported <html lang> and uses the browser language", () => {
        setHtmlLang("de-DE");
        setBrowserLanguage("fr-FR");
        expect(detectPageLanguage()).toBe("fr");
    });
});
