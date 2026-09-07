import i18next from "i18next";
import { describe, expect, it } from "vitest";
import type { DefaultTranslationKey } from "../../types";
import { defaultNS, fallbackLng, supportedLngs } from "../config";

/**
 * Keys the standalone `/sharing` + `/install` entrypoints resolve at runtime.
 * They are bundled by name, so one missing export renders the key itself.
 */
const REQUIRED_KEYS = [
    "installCode.title",
] as const satisfies readonly DefaultTranslationKey[];

async function standaloneInstance(lng: "en" | "fr") {
    const { translation, customized, common } =
        lng === "en"
            ? await import("./en/standalone")
            : await import("./fr/standalone");

    const instance = i18next.createInstance();
    await instance.init({
        lng,
        defaultNS,
        ns: ["translation", "customized", "common"],
        fallbackLng,
        fallbackNS: ["customized", "common"],
        supportedLngs,
        resources: { [lng]: { translation, customized, common } },
    });
    return instance;
}

describe.each(["en", "fr"] as const)("standalone locale bundle (%s)", (lng) => {
    it("resolves every key the standalone pages render", async () => {
        const instance = await standaloneInstance(lng);

        for (const key of REQUIRED_KEYS) {
            const resolved: string = instance.t(key);

            expect(instance.exists(key), `${key} is not bundled`).toBe(true);
            expect(resolved).not.toBe(key);
            expect(resolved.length).toBeGreaterThan(0);
        }
    });

    it("keeps the sharing page's own trees", async () => {
        const instance = await standaloneInstance(lng);

        expect(instance.exists("sdk.sharingPage.confirmation.cta")).toBe(true);
    });
});
