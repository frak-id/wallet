import { describe, expect, it } from "vitest";
import { componentDefaults } from "./defaults";

const en = Object.entries(componentDefaults.en.ambassador);
const fr = Object.entries(componentDefaults.fr.ambassador);

const reminderBlocks = [
    ["banner", componentDefaults.fr.banner],
    ["rewardReminder", componentDefaults.fr.rewardReminder],
] as const;

describe("reminder copy", () => {
    it("speaks of the reward in the singular in French", () => {
        const offenders = reminderBlocks.flatMap(([block, texts]) =>
            Object.entries(texts)
                .filter(([, text]) => /pour les recevoir/.test(text))
                .map(([key]) => `${block}.${key}`)
        );
        expect(offenders).toEqual([]);
    });

    it("uses the same verb to claim in the pill, the card and the banner", () => {
        const { fr, en } = {
            fr: componentDefaults.fr,
            en: componentDefaults.en,
        };
        expect(fr.rewardReminder.pillLabel).toContain("récupérer");
        expect(fr.rewardReminder.cta).toMatch(/^Récupérer/);
        expect(fr.banner.pendingCta).toMatch(/^Récupérer/);
        expect(en.rewardReminder.pillLabel).toContain("claim");
    });

    it("keeps French apostrophes typographic in the reminder copy", () => {
        const offenders = reminderBlocks.flatMap(([block, texts]) =>
            Object.entries(texts)
                .filter(
                    ([key, text]) =>
                        (block === "rewardReminder" ||
                            key.startsWith("pending")) &&
                        text.includes("'")
                )
                .map(([key]) => `${block}.${key}`)
        );
        expect(offenders).toEqual([]);
    });
});

describe("ambassador copy", () => {
    it("never puts an article or a preposition that needs elision before {BRAND}", () => {
        const offenders = [...en, ...fr].filter(([, text]) =>
            /\b(a|de|le|la) \{BRAND\}/i.test(text)
        );
        expect(offenders).toEqual([]);
    });

    it("uses typographic apostrophes in French", () => {
        expect(fr.filter(([, text]) => text.includes("'"))).toEqual([]);
    });

    it("keeps French high punctuation on its line with a non-breaking space", () => {
        expect(
            fr.filter(([, text]) => /[^\u00A0\u202F][?!:;]/.test(text))
        ).toEqual([]);
    });
});
