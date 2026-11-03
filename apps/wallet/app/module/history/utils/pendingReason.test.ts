import { describe, expect, test } from "vitest";
import { pendingReason } from "./pendingReason";

const NOW = 1_700_000_000_000;
const purchase = { id: "p1", amount: 40, currency: "EUR" };

describe("pendingReason", () => {
    test("waits on the brand when a purchase is behind the reward", () => {
        expect(pendingReason({ purchase, availableAt: NOW + 1 }, NOW)).toEqual({
            kind: "purchase",
        });
    });

    test("waits on the lockup date when it is still ahead", () => {
        expect(pendingReason({ availableAt: NOW + 1 }, NOW)).toEqual({
            kind: "date",
            availableAt: NOW + 1,
        });
    });

    test.each([
        { availableAt: undefined },
        { availableAt: NOW },
        { availableAt: NOW - 1 },
    ])("waits only on the payout when availableAt is $availableAt", (item) => {
        expect(pendingReason(item, NOW)).toEqual({ kind: "payout" });
    });
});
