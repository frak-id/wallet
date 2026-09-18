import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import {
    _resetI18nOverrideQueueForTests,
    drainPendingI18nOverrides,
    enqueueI18nOverride,
    enqueueLanguageChange,
} from "./i18nOverrideQueue";

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

type FakeI18n = {
    language: string;
    changeLanguage: ReturnType<typeof vi.fn>;
};

function makeI18n(lang = "en"): FakeI18n {
    const fake: FakeI18n = {
        language: lang,
        changeLanguage: vi.fn(),
    };
    fake.changeLanguage.mockImplementation(async (l: string) => {
        calls.push(`changeLanguage:${l}`);
        fake.language = l;
    });
    return fake;
}

describe("i18nOverrideQueue", () => {
    beforeEach(() => {
        _resetI18nOverrideQueueForTests();
        vi.clearAllMocks();
        calls.length = 0;
        mockEnsureI18nBundle.mockImplementation(async (lang: string) => {
            await Promise.resolve();
            calls.push(`ensureBundle:${lang}`);
        });
    });

    test("loads the locale bundle before switching language", async () => {
        const i18n = makeI18n("en");
        drainPendingI18nOverrides(
            i18n as unknown as Parameters<typeof drainPendingI18nOverrides>[0]
        );

        enqueueLanguageChange("fr");
        await new Promise((r) => setTimeout(r, 0));

        expect(calls).toEqual(["ensureBundle:fr", "changeLanguage:fr"]);
    });

    test("queues language change before drain and applies on drain", async () => {
        enqueueLanguageChange("fr");
        const i18n = makeI18n("en");

        drainPendingI18nOverrides(
            i18n as unknown as Parameters<typeof drainPendingI18nOverrides>[0]
        );

        // microtasks settle
        await Promise.resolve();
        await Promise.resolve();

        expect(i18n.changeLanguage).toHaveBeenCalledWith("fr");
    });

    test("queues i18n override before drain and applies on drain", async () => {
        enqueueI18nOverride({ "app.title": "Hello" });
        const i18n = makeI18n();

        drainPendingI18nOverrides(
            i18n as unknown as Parameters<typeof drainPendingI18nOverrides>[0]
        );

        // Wait for the dynamic import + apply to settle.
        await new Promise((r) => setTimeout(r, 0));

        expect(mockMapI18nConfig).toHaveBeenCalledWith(
            { "app.title": "Hello" },
            i18n
        );
    });

    test("applies immediately when an i18n is already attached", async () => {
        const i18n = makeI18n("en");
        drainPendingI18nOverrides(
            i18n as unknown as Parameters<typeof drainPendingI18nOverrides>[0]
        );

        enqueueLanguageChange("fr");
        await Promise.resolve();
        await Promise.resolve();

        expect(i18n.changeLanguage).toHaveBeenCalledWith("fr");
    });

    test("skips changeLanguage when language already matches", async () => {
        const i18n = makeI18n("fr");
        drainPendingI18nOverrides(
            i18n as unknown as Parameters<typeof drainPendingI18nOverrides>[0]
        );

        enqueueLanguageChange("fr");
        await Promise.resolve();
        await Promise.resolve();

        expect(i18n.changeLanguage).not.toHaveBeenCalled();
    });

    test("drain is idempotent across multiple calls", async () => {
        enqueueLanguageChange("fr");
        const i18n = makeI18n("en");

        drainPendingI18nOverrides(
            i18n as unknown as Parameters<typeof drainPendingI18nOverrides>[0]
        );
        drainPendingI18nOverrides(
            i18n as unknown as Parameters<typeof drainPendingI18nOverrides>[0]
        );

        await Promise.resolve();
        await Promise.resolve();

        // language should only be applied once: pending was drained on the first call.
        expect(i18n.changeLanguage).toHaveBeenCalledTimes(1);
    });
});
