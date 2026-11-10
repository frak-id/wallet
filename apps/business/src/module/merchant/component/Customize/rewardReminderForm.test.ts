import { describe, expect, it } from "vitest";
import {
    formValuesToRewardReminder,
    rewardReminderToFormValues,
} from "./rewardReminderForm";

describe("rewardReminderToFormValues", () => {
    it("reads an unset reminder as on, at the left", () => {
        const values = rewardReminderToFormValues(undefined);

        expect(values.enabled).toBe(true);
        expect(values.position).toBe("left");
    });

    it("reads a stored enabled: false as off", () => {
        expect(rewardReminderToFormValues({ enabled: false }).enabled).toBe(
            false
        );
    });
});

describe("formValuesToRewardReminder", () => {
    it("saves no entry when everything is at its default", () => {
        expect(
            formValuesToRewardReminder(
                rewardReminderToFormValues(undefined),
                undefined
            )
        ).toBeUndefined();
    });

    it("round-trips enabled: false", () => {
        const stored = { enabled: false as const };

        expect(
            formValuesToRewardReminder(
                rewardReminderToFormValues(stored),
                stored
            )
        ).toEqual(stored);
    });

    it("stores the right position and the typed texts", () => {
        const values = rewardReminderToFormValues(undefined);
        values.position = "right";
        values.title.fr = "Récupérez {REWARD}";
        values.cta.default = "Claim";

        expect(formValuesToRewardReminder(values, undefined)).toEqual({
            position: "right",
            title: { fr: "Récupérez {REWARD}" },
            cta: "Claim",
        });
    });

    it("keeps a stored left position that overrides the SDK config", () => {
        const stored = { position: "left" as const };

        expect(
            formValuesToRewardReminder(
                rewardReminderToFormValues(stored),
                stored
            )
        ).toEqual(stored);
    });

    it("stores left when the merchant switches back from a stored right", () => {
        const stored = { position: "right" as const };
        const values = rewardReminderToFormValues(stored);
        values.position = "left";

        expect(formValuesToRewardReminder(values, stored)).toEqual({
            position: "left",
        });
    });

    it("carries the stored raw CSS through and counts it as content", () => {
        const stored = { rawCss: "a { color: red; }", css: "a{color:red}" };

        expect(
            formValuesToRewardReminder(
                rewardReminderToFormValues(stored),
                stored
            )
        ).toEqual(stored);
    });
});
