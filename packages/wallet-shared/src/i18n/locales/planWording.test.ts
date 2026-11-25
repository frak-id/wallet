import { describe, expect, it } from "vitest";
import en from "./en/translation.json";
import fr from "./fr/translation.json";

const cancellationWording =
    /cancel|unsubscri|stopped|quit|friend|annul|résili|désabonn|ami/i;
const referrerFacingSteps = [
    "upcoming",
    "upcomingAmount",
    "upcomingDuration_one",
    "upcomingDuration_other",
    "expired",
] as const;

describe.each([
    ["en", en],
    ["fr", fr],
])("%s subscription plan wording", (_lang, translation) => {
    it.each(referrerFacingSteps)(
        "says nothing of a cancellation on the %s step",
        (step) => {
            expect(translation.reward.plan.step[step]).not.toMatch(
                cancellationWording
            );
        }
    );

    it.each(["upcomingReferee", "upcomingAmountReferee"] as const)(
        "says nothing of a cancellation on the referee's %s step",
        (step) => {
            expect(translation.reward.plan.step[step]).not.toMatch(
                cancellationWording
            );
        }
    );
});

describe("en subscription plan wording", () => {
    it("ties an upcoming step to the next renewal", () => {
        expect(en.reward.plan.step.upcoming).toBe(
            "Unlocks at the next renewal"
        );
    });
});

describe("subscription plan duration wording", () => {
    it.each([
        ["en", en, "Unlocks after 1 day of subscription"],
        ["fr", fr, "Se débloque après 1 jour d'abonnement"],
    ])("reads a singular day in %s", (_lang, translation, expected) => {
        expect(
            translation.reward.plan.step.upcomingDuration_one.replace(
                "{{count}}",
                "1"
            )
        ).toBe(expected);
    });
});
