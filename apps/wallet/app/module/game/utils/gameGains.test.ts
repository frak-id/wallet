import { describe, expect, it } from "vitest";
import { gainsSince } from "./gameGains";

const seen = (tickets: Partial<Record<string, number>>, eligible = true) => ({
    eligible,
    ticketsBySource: {
        join: 1,
        instagramCertified: 0,
        purchase: 0,
        referredPurchase: 0,
        referredSignup: 0,
        brandShare: 0,
        ...tickets,
    },
});

describe("gainsSince", () => {
    it("shows no gain and no unlock without a baseline", () => {
        expect(gainsSince(null, seen({ purchase: 3 }))).toEqual({
            gains: [],
            total: 0,
            unlocked: false,
        });
    });

    it("lists the positive deltas in display order and totals them", () => {
        const result = gainsSince(
            seen({ purchase: 3 }),
            seen({ instagramCertified: 2, purchase: 6, brandShare: 1 })
        );

        expect(result.gains).toEqual([
            { source: "instagramCertified", tickets: 2 },
            { source: "purchase", tickets: 3 },
            { source: "brandShare", tickets: 1 },
        ]);
        expect(result.total).toBe(6);
        expect(result.unlocked).toBe(false);
    });

    it("ignores a source that stayed or went down", () => {
        const result = gainsSince(
            seen({ purchase: 6, referredSignup: 2 }),
            seen({ purchase: 3, referredSignup: 2 })
        );

        expect(result).toMatchObject({ gains: [], total: 0 });
    });

    it("flags the unlock when the tickets were held and now count", () => {
        const result = gainsSince(
            seen({}, false),
            seen({ instagramCertified: 2 })
        );

        expect(result.unlocked).toBe(true);
        expect(result.total).toBe(2);
    });

    it("does not flag an unlock for tickets that were already counting or still are not", () => {
        expect(gainsSince(seen({}, true), seen({}, true)).unlocked).toBe(false);
        expect(gainsSince(seen({}, false), seen({}, false)).unlocked).toBe(
            false
        );
    });
});
