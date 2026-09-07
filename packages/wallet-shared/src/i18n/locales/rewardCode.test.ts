import { describe, expect, it } from "vitest";
import en from "./en/translation.json";
import fr from "./fr/translation.json";

// Component tests assert on i18n keys — the setup loads no resources, so
// i18next echoes the key back. Nothing there can see the words a user reads.
const locales = { en, fr } as const;

// The field label is the code's canonical name, so these stay true through a
// term change: rename the code and every side of each assertion moves together.
describe.each(["en", "fr"] as const)("reward code naming (%s)", (lng) => {
    const t = locales[lng];
    const name = t.rewardCode.codeLabel.toLowerCase();

    it("names the code in the install page headline", () => {
        expect(t.installCode.title.toLowerCase()).toContain(name);
    });

    it("quotes the app's entry button verbatim in the install instruction", () => {
        const quoted =
            t.installCode.infoDescription.match(/<1>"(.+?)"<\/1>/)?.[1];
        expect(quoted).toBe(t.onboarding.rewardCode);
    });
});
