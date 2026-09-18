import type { i18n as I18nType } from "i18next";
import i18next from "i18next";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";

const frListener = {
    common: { sharing: { btn: { share: "Partager", copy: "Copier" } } },
    customized: {
        sdk: {
            sharingPage: {
                dismiss: "Fermer",
                reward: { title: "Gagnez 5€", tagline: "En partageant" },
            },
        },
    },
};

vi.mock("@frak-labs/wallet-shared/i18n/locales/fr/listener", () => frListener);
vi.mock("@frak-labs/wallet-shared/i18n/locales/en/listener", () => ({
    common: {},
    customized: {},
}));

async function freshInstance(): Promise<I18nType> {
    const instance = i18next.createInstance();
    await instance.init({
        lng: "fr",
        fallbackLng: "fr",
        ns: ["customized", "common"],
        defaultNS: "customized",
        fallbackNS: "common",
        supportedLngs: ["en", "fr"],
        partialBundledLanguages: true,
        resources: {},
    });
    return instance;
}

// The module keeps a per-locale promise cache, so each case needs a fresh copy.
async function freshPreload() {
    vi.resetModules();
    return import("./i18nPreload");
}

describe("ensureI18nBundle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("registers the default bundle", async () => {
        const { ensureI18nBundle } = await freshPreload();
        const i18n = await freshInstance();

        await ensureI18nBundle("fr", i18n);

        expect(i18n.t("sdk.sharingPage.dismiss")).toBe("Fermer");
        expect(i18n.t("sharing.btn.share")).toBe("Partager");
    });

    test("still registers defaults when a merchant override landed first", async () => {
        const { ensureI18nBundle } = await freshPreload();
        const i18n = await freshInstance();

        // A backend/merchant override can create `fr/customized` before the
        // lazily imported locale chunk resolves.
        i18n.addResourceBundle(
            "fr",
            "customized",
            { sdk: { sharingPage: { reward: { title: "Gagnez gros" } } } },
            true,
            true
        );

        await ensureI18nBundle("fr", i18n);

        expect(i18n.t("sdk.sharingPage.dismiss")).toBe("Fermer");
        expect(i18n.t("sdk.sharingPage.reward.tagline")).toBe("En partageant");
        expect(i18n.t("sharing.btn.copy")).toBe("Copier");
        // The override still wins over the default it replaces.
        expect(i18n.t("sdk.sharingPage.reward.title")).toBe("Gagnez gros");
    });

    test("ignores a locale it does not bundle", async () => {
        const { ensureI18nBundle } = await freshPreload();
        const i18n = await freshInstance();

        await ensureI18nBundle("de", i18n);

        expect(i18n.hasResourceBundle("de", "customized")).toBe(false);
    });
});
