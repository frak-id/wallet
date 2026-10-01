import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import { describe, expect, it } from "vitest";
import { AMBASSADOR_FIELD_GROUPS } from "./ambassadorForm";
import {
    AMBASSADOR_TONE_PRESET_FIELDS,
    AMBASSADOR_TONE_PRESETS,
    type AmbassadorTonePresetField,
    applyBrand,
    BANNER_PRESETS,
    BUTTON_SHARE_PRESETS,
    formatPresetLabel,
    matchAmbassadorTonePreset,
    matchBannerPreset,
    matchButtonSharePreset,
    matchPostPurchasePreset,
    POST_PURCHASE_PRESETS,
} from "./presets";
import type { LocalizedText } from "./types";

describe("applyBrand", () => {
    it("substitutes the brand token", () => {
        expect(applyBrand("Shop with {Brand} today", "Nowa")).toBe(
            "Shop with Nowa today"
        );
    });

    it("returns text without token unchanged", () => {
        expect(applyBrand("No token here", "Nowa")).toBe("No token here");
    });

    it("keeps replacement patterns in the brand name literal", () => {
        expect(applyBrand("A gift from {Brand}", "Bob$&Jane$$")).toBe(
            "A gift from Bob$&Jane$$"
        );
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

describe("AMBASSADOR_TONE_PRESETS", () => {
    it("covers every ambassador text field except the FAQ", () => {
        const { faq: _faq, ...toneGroups } = AMBASSADOR_FIELD_GROUPS;
        expect(new Set(AMBASSADOR_TONE_PRESET_FIELDS)).toEqual(
            new Set(Object.values(toneGroups).flat())
        );
    });

    it("ships non-empty en + fr text for all 8 fields of every preset", () => {
        for (const preset of AMBASSADOR_TONE_PRESETS) {
            for (const field of AMBASSADOR_TONE_PRESET_FIELDS) {
                expect(preset.en[field].trim().length).toBeGreaterThan(0);
                expect(preset.fr[field].trim().length).toBeGreaterThan(0);
            }
        }
    });

    it("keeps {BRAND} as a literal token and never uses the shop-name form", () => {
        for (const preset of AMBASSADOR_TONE_PRESETS) {
            for (const text of [
                ...Object.values(preset.en),
                ...Object.values(preset.fr),
            ]) {
                expect(text).not.toContain("{Brand}");
            }
        }
        expect(AMBASSADOR_TONE_PRESETS[2].en.heroTitle).toContain("{BRAND}");
    });

    it("index 0 is the SDK's built-in page copy in en and fr", () => {
        for (const lang of ["en", "fr"] as const) {
            const copy = componentDefaults[lang].ambassador;
            expect(AMBASSADOR_TONE_PRESETS[0][lang]).toEqual({
                heroTitle: copy.heroHeadline,
                heroLede: copy.heroLedeReward,
                heroRewardCaption: copy.heroRewardCaption,
                rewardHeading: copy.rewardHeadingReward,
                rewardLede: copy.rewardLede,
                heroCtaLabel: copy.heroCtaLabel,
                rewardCtaLabel: copy.rewardCtaLabel,
                referralCtaLabel: copy.referralCtaLabel,
            });
        }
    });

    it("keeps the reward amount out of every tone but Classic", () => {
        for (const preset of AMBASSADOR_TONE_PRESETS.slice(1)) {
            for (const text of [
                ...Object.values(preset.en),
                ...Object.values(preset.fr),
            ]) {
                expect(text).not.toContain("{REWARD}");
            }
        }
    });
});

describe("matchAmbassadorTonePreset", () => {
    const empty = () => ({ default: "", en: "", fr: "" });
    const textsOf = (
        fill: (field: AmbassadorTonePresetField) => LocalizedText
    ) =>
        Object.fromEntries(
            AMBASSADOR_TONE_PRESET_FIELDS.map((field) => [field, fill(field)])
        ) as Record<AmbassadorTonePresetField, LocalizedText>;
    const match = (texts: Record<AmbassadorTonePresetField, LocalizedText>) =>
        matchAmbassadorTonePreset(
            AMBASSADOR_TONE_PRESET_FIELDS.map((field) => texts[field])
        );
    const picked = (index: number) =>
        textsOf((field) => ({
            default: "",
            en: AMBASSADOR_TONE_PRESETS[index].en[field],
            fr: AMBASSADOR_TONE_PRESETS[index].fr[field],
        }));

    it("returns Classic when every tier of every field is empty", () => {
        expect(match(textsOf(empty))).toBe(0);
    });

    it("returns null when a single field has an all-languages value", () => {
        const texts = textsOf(empty);
        texts.heroTitle.default = "Join us";
        expect(match(texts)).toBeNull();
    });

    it("returns each other tone for its en + fr copy, whitespace ignored", () => {
        for (const index of [1, 2, 3]) {
            const texts = picked(index);
            texts.heroTitle.en = `  ${texts.heroTitle.en}\n`;
            expect(match(texts)).toBe(index);
        }
    });

    it("returns null when any single en or fr value differs", () => {
        for (const field of AMBASSADOR_TONE_PRESET_FIELDS) {
            for (const lang of ["en", "fr"] as const) {
                const texts = picked(2);
                texts[field][lang] = "Custom wording";
                expect(match(texts)).toBeNull();
            }
        }
    });

    it("returns null when a picked tone also carries an all-languages value", () => {
        const texts = picked(1);
        texts.rewardLede.default = "Custom wording";
        expect(match(texts)).toBeNull();
    });
});
