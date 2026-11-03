import { moneriumOrder } from "@/tests/moneriumFixtures";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import {
    formatOrderAmount,
    orderAmountColor,
    orderTimestamp,
} from "./orderDisplay";

describe("formatOrderAmount", () => {
    test("a redeem leaves the wallet and an issue lands in it", () => {
        const redeem = formatOrderAmount(
            moneriumOrder({ amount: "12.5" }),
            "en"
        );
        const issue = formatOrderAmount(
            moneriumOrder({ kind: "issue", amount: "12.5" }),
            "en"
        );

        expect(redeem).toMatch(/^-.*12\.50/);
        expect(issue).toMatch(/^\+.*12\.50/);
    });

    test("an amount that is not a number is shown as is", () => {
        expect(formatOrderAmount(moneriumOrder({ amount: "n/a" }), "en")).toBe(
            "-n/a"
        );
    });
});

describe("orderAmountColor", () => {
    test.for([
        ["redeem", "pending", "disabled"],
        ["issue", "rejected", "disabled"],
        ["redeem", "processed", "primary"],
        ["issue", "processed", "success"],
    ] as const)("a %s order that is %s is %s", ([kind, state, color]) => {
        expect(orderAmountColor(moneriumOrder({ kind, state }))).toBe(color);
    });
});

describe("orderTimestamp", () => {
    test("prefers the processing time and falls back to the placing time", () => {
        const placedAt = "2024-01-01T10:00:00Z";
        const processedAt = "2024-01-01T12:00:00Z";

        expect(orderTimestamp(moneriumOrder({ placedAt, processedAt }))).toBe(
            Date.parse(processedAt)
        );
        expect(orderTimestamp(moneriumOrder({ placedAt }))).toBe(
            Date.parse(placedAt)
        );
    });
});
