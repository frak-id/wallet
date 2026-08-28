import { describe, expect, it } from "vitest";
import {
    formatSharingPreview,
    matchSharingPreset,
    SHARING_PRESETS,
} from "./presets";
import {
    sharingValuesToTranslations,
    translationsToSharingValues,
} from "./sharingTranslations";
import type { SharingWordingFormValues } from "./types";

const blank: SharingWordingFormValues = {
    title: { default: "", en: "", fr: "" },
    text: { default: "", en: "", fr: "" },
};

describe("translationsToSharingValues", () => {
    it("transposes tier -> key storage into key -> tier form values", () => {
        expect(
            translationsToSharingValues({
                en: { "sharing.title": "EN title", "sharing.text": "EN text" },
                fr: { "sharing.title": "FR title" },
            })
        ).toEqual({
            title: { default: "", en: "EN title", fr: "FR title" },
            text: { default: "", en: "EN text", fr: "" },
        });
    });

    it("reads blank tiers for an unset config", () => {
        expect(translationsToSharingValues(undefined)).toEqual(blank);
    });

    it("ignores translation keys it does not own", () => {
        expect(
            translationsToSharingValues({
                en: { "sdk.wallet.login.text": "Log in" },
            })
        ).toEqual(blank);
    });
});

describe("sharingValuesToTranslations", () => {
    it("writes each tier under its own key", () => {
        expect(
            sharingValuesToTranslations(
                {
                    title: { default: "", en: "EN title", fr: "FR title" },
                    text: { default: "Fallback", en: "", fr: "" },
                },
                undefined
            )
        ).toEqual({
            default: { "sharing.text": "Fallback" },
            en: { "sharing.title": "EN title" },
            fr: { "sharing.title": "FR title" },
        });
    });

    it("preserves keys owned by other editors", () => {
        expect(
            sharingValuesToTranslations(
                { ...blank, title: { default: "", en: "Mine", fr: "" } },
                { en: { "sdk.wallet.login.text": "Log in" } }
            )
        ).toEqual({
            en: { "sdk.wallet.login.text": "Log in", "sharing.title": "Mine" },
        });
    });

    // A stored "" resolves as a real override in i18next and shadows the
    // bundled default, so clearing a field must delete the key instead.
    it("deletes a cleared key rather than storing an empty string", () => {
        expect(
            sharingValuesToTranslations(blank, {
                en: { "sharing.title": "Previous" },
            })
        ).toBeNull();
    });

    // `undefined` would be dropped by JSON.stringify, and the route keeps the
    // stored dictionary when the key is absent — the clear would silently revert.
    it("returns null rather than undefined so the clear reaches the route", () => {
        const cleared = sharingValuesToTranslations(blank, {
            en: { "sharing.title": "Previous" },
        });
        expect(cleared).toBeNull();
        expect(JSON.stringify({ translations: cleared })).toContain(
            '"translations":null'
        );
    });

    it("drops a tier that becomes empty but keeps its siblings", () => {
        expect(
            sharingValuesToTranslations(
                { ...blank, title: { default: "", en: "Kept", fr: "" } },
                {
                    en: { "sharing.title": "Previous" },
                    fr: { "sharing.title": "Précédent" },
                }
            )
        ).toEqual({ en: { "sharing.title": "Kept" } });
    });

    it("trims before deciding a tier is empty", () => {
        expect(
            sharingValuesToTranslations(
                { ...blank, title: { default: "   ", en: "  Real  ", fr: "" } },
                undefined
            )
        ).toEqual({ en: { "sharing.title": "Real" } });
    });

    it("round-trips through the form representation", () => {
        const stored = {
            en: { "sharing.title": "EN title", "sharing.text": "EN text" },
            fr: { "sharing.title": "FR title", "sharing.text": "FR text" },
        };
        expect(
            sharingValuesToTranslations(
                translationsToSharingValues(stored),
                stored
            )
        ).toEqual(stored);
    });
});

describe("sharing presets", () => {
    it("ships non-empty en + fr copy for both slots", () => {
        for (const preset of SHARING_PRESETS) {
            for (const lang of ["en", "fr"] as const) {
                expect(preset[lang].title.trim().length).toBeGreaterThan(0);
                expect(preset[lang].text.trim().length).toBeGreaterThan(0);
            }
        }
    });

    // Every preset is read by a merchant in the picker, so no interpolation
    // token may reach the screen — index 0 keeps `{{productName}}` in its
    // stored value on purpose, which is exactly what must not be displayed.
    it("leaves no interpolation token in any preview label", () => {
        for (const preset of SHARING_PRESETS) {
            for (const slot of [preset.en.title, preset.en.text]) {
                const label = formatSharingPreview(slot, "Nowa");
                expect(label).not.toContain("{Brand}");
                expect(label).not.toContain("{{productName}}");
            }
        }
    });

    it("substitutes the shop name into both interpolation styles", () => {
        expect(
            formatSharingPreview("{{productName}} invite link", "Nowa")
        ).toBe("Nowa invite link");
        expect(formatSharingPreview("A gift from {Brand}", "Nowa")).toBe(
            "A gift from Nowa"
        );
        expect(formatSharingPreview("{{ productName }} spaced", "Nowa")).toBe(
            "Nowa spaced"
        );
    });

    // Index 0 must stay byte-identical to the bundled wallet copy, so picking it
    // stores what an unconfigured merchant already renders. These are literals,
    // not an import: `wallet-shared` is off-limits to business (root AGENTS.md).
    // So this catches a careless edit here, NOT drift in the wallet — see FRA-295.
    it("pins index 0 to the wallet's bundled default", () => {
        expect(SHARING_PRESETS[0].en.title).toBe("{{productName}} invite link");
        expect(SHARING_PRESETS[0].fr.title).toBe(
            "Lien d'invitation {{productName}}"
        );
        expect(SHARING_PRESETS[0].en.text).toBe(
            "Discover this amazing product!"
        );
        expect(SHARING_PRESETS[0].fr.text).toBe(
            "Découvrez ce produit incroyable !"
        );
    });

    it("never ships both interpolation styles in one slot", () => {
        for (const preset of SHARING_PRESETS) {
            for (const lang of ["en", "fr"] as const) {
                const both =
                    preset[lang].title.includes("{Brand}") &&
                    preset[lang].title.includes("{{productName}}");
                expect(both).toBe(false);
            }
        }
    });

    const branded = (text: string, shop: string) =>
        text.replace(/\{Brand\}/g, shop);

    it("matches a stored preset back after brand substitution", () => {
        const preset = SHARING_PRESETS[1];
        expect(
            matchSharingPreset(
                branded(preset.en.title, "Nowa"),
                branded(preset.en.text, "Nowa"),
                "Nowa"
            )
        ).toBe(1);
    });

    // A preset writes both slots, so matching the title alone would leave the
    // radio selected over copy the merchant has since rewritten.
    it("deselects once either slot is customised", () => {
        const preset = SHARING_PRESETS[1];
        expect(
            matchSharingPreset(
                branded(preset.en.title, "Nowa"),
                "My own text",
                "Nowa"
            )
        ).toBeNull();
    });

    // `shopName` is empty while the merchant query loads; substitution then
    // leaves padding that must not defeat the comparison.
    it("matches despite the padding an empty shop name leaves", () => {
        const preset = SHARING_PRESETS[1];
        expect(
            matchSharingPreset(
                branded(preset.en.title, "").trim(),
                branded(preset.en.text, "").trim(),
                ""
            )
        ).toBe(1);
    });

    it("reports custom wording as unmatched", () => {
        expect(
            matchSharingPreset("Something bespoke", "Also bespoke", "Nowa")
        ).toBeNull();
        expect(matchSharingPreset("", "", "Nowa")).toBeNull();
    });
});
