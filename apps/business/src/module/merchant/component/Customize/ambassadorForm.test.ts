import { describe, expect, it } from "vitest";
import {
    ambassadorToFormValues,
    formValuesToAmbassador,
} from "./ambassadorForm";

const HERO = "https://cdn.example.com/hero.jpg";

describe("formValuesToAmbassador", () => {
    it("leaves out empty texts and the photo when none was chosen", () => {
        const values = ambassadorToFormValues(undefined);
        values.texts.heroTitle.fr = "Rejoignez-nous";

        expect(formValuesToAmbassador(values)).toEqual({
            heroTitle: { fr: "Rejoignez-nous" },
        });
    });

    it("saves no entry at all when nothing is set", () => {
        expect(
            formValuesToAmbassador(ambassadorToFormValues(undefined))
        ).toBeUndefined();
    });

    it("saves the no-photo choice as none", () => {
        const values = ambassadorToFormValues(undefined);
        values.photo = "none";

        expect(formValuesToAmbassador(values)).toEqual({
            heroImageUrl: "none",
        });
    });

    it("saves a custom photo, and falls back to the default when its URL is empty", () => {
        const values = ambassadorToFormValues(undefined);
        values.photo = "custom";
        expect(formValuesToAmbassador(values)).toBeUndefined();

        values.heroImageUrl = HERO;
        expect(formValuesToAmbassador(values)).toEqual({ heroImageUrl: HERO });
    });
});

describe("ambassadorToFormValues", () => {
    it("selects the photo mode from the stored value", () => {
        expect(ambassadorToFormValues(undefined).photo).toBe("default");
        expect(ambassadorToFormValues({ heroImageUrl: "none" }).photo).toBe(
            "none"
        );
        expect(ambassadorToFormValues({ heroImageUrl: HERO })).toMatchObject({
            photo: "custom",
            heroImageUrl: HERO,
        });
    });

    it("round-trips a stored entry unchanged", () => {
        const stored = {
            heroTitle: "Join {BRAND}",
            faq5Answer: { en: "Frak pays you.", fr: "Frak vous paie." },
            heroImageUrl: HERO,
        };

        expect(formValuesToAmbassador(ambassadorToFormValues(stored))).toEqual(
            stored
        );
    });
});
