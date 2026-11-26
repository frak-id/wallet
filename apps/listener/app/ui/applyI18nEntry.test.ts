import type { i18n as I18nType } from "i18next";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { applyI18nEntry } from "./applyI18nEntry";

const { mockMapI18nConfig, mockEnsureI18nBundle, calls } = vi.hoisted(() => ({
    mockMapI18nConfig: vi.fn(),
    mockEnsureI18nBundle: vi.fn(),
    calls: [] as string[],
}));

vi.mock("@/module/utils/i18nMapper", () => ({
    mapI18nConfig: mockMapI18nConfig,
}));

vi.mock("@/i18nPreload", () => ({
    ensureI18nBundle: mockEnsureI18nBundle,
}));

function makeI18n(lang = "en") {
    const fake = {
        language: lang,
        changeLanguage: vi.fn(async (l: string) => {
            calls.push(`changeLanguage:${l}`);
            fake.language = l;
        }),
    };
    return fake;
}

describe("applyI18nEntry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calls.length = 0;
        mockEnsureI18nBundle.mockImplementation(async (lang: string) => {
            await Promise.resolve();
            calls.push(`ensureBundle:${lang}`);
        });
    });

    test("loads the locale bundle before switching language", async () => {
        const i18n = makeI18n("en");

        await applyI18nEntry(i18n as unknown as I18nType, {
            kind: "language",
            payload: "fr",
        });

        expect(calls).toEqual(["ensureBundle:fr", "changeLanguage:fr"]);
    });

    test("skips the switch when the language already matches", async () => {
        const i18n = makeI18n("fr");

        await applyI18nEntry(i18n as unknown as I18nType, {
            kind: "language",
            payload: "fr",
        });

        expect(i18n.changeLanguage).not.toHaveBeenCalled();
    });

    test("maps an override onto the i18n instance", async () => {
        const i18n = makeI18n();

        await applyI18nEntry(i18n as unknown as I18nType, {
            kind: "override",
            payload: { "app.title": "Hello" },
        });

        expect(mockMapI18nConfig).toHaveBeenCalledWith(
            { "app.title": "Hello" },
            i18n
        );
    });
});
