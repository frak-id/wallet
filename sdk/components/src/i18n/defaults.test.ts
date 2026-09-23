import { describe, expect, it } from "vitest";
import { componentDefaults } from "./defaults";

const en = Object.entries(componentDefaults.en.ambassador);
const fr = Object.entries(componentDefaults.fr.ambassador);

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
