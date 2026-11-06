import { describe, expect, it } from "vitest";
import { fillReminderText, pickFiat } from "./format";

const AMOUNTS = { eurAmount: 12.5, usdAmount: 13.4, gbpAmount: 10.8 };

describe("pickFiat", () => {
    it.each([
        ["eur", 12.5],
        ["usd", 13.4],
        ["gbp", 10.8],
        [undefined, 12.5],
    ] as const)("picks the %s figure", (currency, expected) => {
        expect(pickFiat(AMOUNTS, currency)).toBe(expected);
    });
});

describe("fillReminderText", () => {
    it("fills every placeholder", () => {
        expect(
            fillReminderText("{REWARD} at {BRAND}: {DAYS} days, until {DATE}", {
                reward: "12,50 €",
                days: 28,
                date: "5 déc.",
                brand: "Harmo",
            })
        ).toBe("12,50 € at Harmo: 28 days, until 5 déc.");
    });

    it("keeps a `$&` in a brand name literal", () => {
        expect(fillReminderText("{BRAND}", { brand: "A$&B" })).toBe("A$&B");
    });

    it("empties a placeholder without a value", () => {
        expect(fillReminderText("{DAYS} days", {})).toBe(" days");
    });
});
