import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { prizeOf, prizeToWinOf } from "./gamePrize";

const t = ((key: string, values?: { prize?: string }) =>
    `${key}:${values?.prize}`) as unknown as TFunction;

describe("prizeOf", () => {
    it("prefers the game's own wording", () => {
        expect(
            prizeOf({ prizeAmount: 50, prizeDescription: "A trip" }, "fr-FR")
        ).toBe("A trip");
    });

    it("falls back on the amount", () => {
        expect(
            prizeOf({ prizeAmount: 50, prizeDescription: null }, "fr-FR")
        ).toMatch(/^50\s€$/);
    });
});

describe("prizeToWinOf", () => {
    it("says a bare amount is to win", () => {
        expect(
            prizeToWinOf(
                t,
                { prizeAmount: 50, prizeDescription: null },
                "fr-FR"
            )
        ).toMatch(/^game\.prizeToWin:50\s€$/);
    });

    it("leaves a description as it is", () => {
        expect(
            prizeToWinOf(
                t,
                { prizeAmount: 50, prizeDescription: "A trip" },
                "fr-FR"
            )
        ).toBe("A trip");
    });
});
