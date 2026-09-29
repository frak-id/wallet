import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import { describe, expect, it } from "vitest";
import {
    AMBASSADOR_FAQ_PRESET_FIELDS,
    AMBASSADOR_FAQ_PRESETS,
    applyBrand,
    BANNER_PRESETS,
    BUTTON_SHARE_PRESETS,
    formatPresetLabel,
    matchAmbassadorFaqPreset,
    matchBannerPreset,
    matchButtonSharePreset,
    matchPostPurchasePreset,
    POST_PURCHASE_PRESETS,
} from "./presets";

describe("applyBrand", () => {
    it("substitutes the brand token", () => {
        expect(applyBrand("Shop with {Brand} today", "Nowa")).toBe(
            "Shop with Nowa today"
        );
    });

    it("returns text without token unchanged", () => {
        expect(applyBrand("No token here", "Nowa")).toBe("No token here");
    });
});

describe("preset catalogue", () => {
    it("ships non-empty en + fr copy for every preset", () => {
        for (const preset of BUTTON_SHARE_PRESETS) {
            expect(preset.en.trim().length).toBeGreaterThan(0);
            expect(preset.fr.trim().length).toBeGreaterThan(0);
        }
        for (const preset of POST_PURCHASE_PRESETS) {
            for (const audience of [preset.referee, preset.referrer]) {
                expect(audience.en.trim().length).toBeGreaterThan(0);
                expect(audience.fr.trim().length).toBeGreaterThan(0);
            }
        }
        for (const preset of BANNER_PRESETS) {
            expect(preset.en.title.trim().length).toBeGreaterThan(0);
            expect(preset.en.description.trim().length).toBeGreaterThan(0);
            expect(preset.fr.title.trim().length).toBeGreaterThan(0);
            expect(preset.fr.description.trim().length).toBeGreaterThan(0);
        }
    });
});

describe("matchButtonSharePreset", () => {
    it("matches each preset on its en copy", () => {
        for (const [index, preset] of BUTTON_SHARE_PRESETS.entries()) {
            expect(matchButtonSharePreset(preset.en)).toBe(index);
        }
    });

    it("matches with surrounding whitespace", () => {
        expect(
            matchButtonSharePreset(`  ${BUTTON_SHARE_PRESETS[1].en}  `)
        ).toBe(1);
    });

    it("returns null for custom text and empty values", () => {
        expect(matchButtonSharePreset("My custom wording")).toBeNull();
        expect(matchButtonSharePreset("")).toBeNull();
        expect(matchButtonSharePreset("   ")).toBeNull();
    });
});

describe("matchPostPurchasePreset", () => {
    it("matches each preset on its referee en copy", () => {
        for (const [index, preset] of POST_PURCHASE_PRESETS.entries()) {
            expect(matchPostPurchasePreset(preset.referee.en)).toBe(index);
        }
    });

    it("matches with surrounding whitespace", () => {
        expect(
            matchPostPurchasePreset(
                `  ${POST_PURCHASE_PRESETS[1].referee.en}  `
            )
        ).toBe(1);
    });

    it("returns null for custom text and empty values", () => {
        expect(matchPostPurchasePreset("Thanks for your purchase")).toBeNull();
        expect(matchPostPurchasePreset("")).toBeNull();
        expect(matchPostPurchasePreset("   ")).toBeNull();
    });
});

describe("matchBannerPreset", () => {
    it("matches title + description pairs", () => {
        expect(
            matchBannerPreset(
                BANNER_PRESETS[0].en.title,
                BANNER_PRESETS[0].en.description,
                "Nowa"
            )
        ).toBe(0);
    });

    it("matches the brand preset after substitution", () => {
        expect(
            matchBannerPreset(
                "A friend unlocked {REWARD} for you",
                "Shop with Nowa and collect your reward after purchase.",
                "Nowa"
            )
        ).toBe(2);
    });

    it("requires both fields to match the same preset", () => {
        expect(
            matchBannerPreset(
                BANNER_PRESETS[0].en.title,
                BANNER_PRESETS[1].en.description,
                "Nowa"
            )
        ).toBeNull();
    });

    it("returns null when either field is empty", () => {
        expect(matchBannerPreset("", "desc", "Nowa")).toBeNull();
        expect(
            matchBannerPreset(BANNER_PRESETS[0].en.title, "", "Nowa")
        ).toBeNull();
    });
});

describe("formatPresetLabel", () => {
    it("replaces every reward token with a sample amount", () => {
        const label = formatPresetLabel("Earn {REWARD} and {REWARD}", "eur");
        expect(label).not.toContain("{REWARD}");
        expect(label).toContain("42");
    });
});

describe("AMBASSADOR_FAQ_PRESETS", () => {
    it("ships non-empty en + fr text for all 8 fields of every preset", () => {
        for (const preset of AMBASSADOR_FAQ_PRESETS) {
            for (const field of AMBASSADOR_FAQ_PRESET_FIELDS) {
                expect(preset.en[field].trim().length).toBeGreaterThan(0);
                expect(preset.fr[field].trim().length).toBeGreaterThan(0);
            }
        }
    });

    it("index 0 equals the SDK default ambassador copy in en and fr", () => {
        for (const field of AMBASSADOR_FAQ_PRESET_FIELDS) {
            expect(AMBASSADOR_FAQ_PRESETS[0].en[field]).toBe(
                componentDefaults.en.ambassador[field]
            );
            expect(AMBASSADOR_FAQ_PRESETS[0].fr[field]).toBe(
                componentDefaults.fr.ambassador[field]
            );
        }
    });
});

describe("matchAmbassadorFaqPreset", () => {
    it("returns each preset index for its en fields", () => {
        for (const [index, preset] of AMBASSADOR_FAQ_PRESETS.entries()) {
            expect(matchAmbassadorFaqPreset(preset.en)).toBe(index);
        }
    });

    it("matches with surrounding whitespace", () => {
        const padded = Object.fromEntries(
            AMBASSADOR_FAQ_PRESET_FIELDS.map((field) => [
                field,
                `  ${AMBASSADOR_FAQ_PRESETS[1].en[field]}\n`,
            ])
        ) as (typeof AMBASSADOR_FAQ_PRESETS)[number]["en"];
        expect(matchAmbassadorFaqPreset(padded)).toBe(1);
    });

    it("returns null when any single field differs", () => {
        for (const [index, preset] of AMBASSADOR_FAQ_PRESETS.entries()) {
            for (const field of AMBASSADOR_FAQ_PRESET_FIELDS) {
                expect(
                    matchAmbassadorFaqPreset({
                        ...preset.en,
                        [field]: `Custom wording ${index}`,
                    })
                ).toBeNull();
            }
        }
    });

    it("returns null when any field is empty", () => {
        for (const field of AMBASSADOR_FAQ_PRESET_FIELDS) {
            expect(
                matchAmbassadorFaqPreset({
                    ...AMBASSADOR_FAQ_PRESETS[0].en,
                    [field]: "   ",
                })
            ).toBeNull();
        }
    });
});
