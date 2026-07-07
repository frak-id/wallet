import type { MerchantReward } from "@frak-labs/core-sdk";
import { describe, expect, test } from "vitest";
import { computeRewardSortValue } from "./explorerRewardSort";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const nowMs = NOW.getTime();
const iso = (offsetMs: number) => new Date(nowMs + offsetMs).toISOString();

function referrer(eurAmount: number): MerchantReward["referrer"] {
    return {
        payoutType: "fixed",
        amount: {
            amount: eurAmount,
            eurAmount,
            usdAmount: eurAmount,
            gbpAmount: eurAmount,
        },
    };
}

function reward(overrides: Partial<MerchantReward>): MerchantReward {
    return {
        campaignId: "c",
        name: "c",
        interactionTypeKey: "referral",
        conditions: [],
        ...overrides,
    };
}

describe("computeRewardSortValue", () => {
    test("empty rewards → zero value, no expiry", () => {
        expect(computeRewardSortValue([], NOW)).toEqual({
            rewardValue: 0,
            soonestExpiry: null,
        });
    });

    test("referrer-only reward with a future expiry", () => {
        const result = computeRewardSortValue(
            [reward({ referrer: referrer(5), expiresAt: iso(1000) })],
            NOW
        );
        expect(result).toEqual({
            rewardValue: 5,
            soonestExpiry: nowMs + 1000,
        });
    });

    test("referee-only reward scores 0 (only referrer is counted)", () => {
        const result = computeRewardSortValue(
            [reward({ referee: referrer(9), expiresAt: null })],
            NOW
        );
        expect(result).toEqual({ rewardValue: 0, soonestExpiry: null });
    });

    test("multiple campaigns → max reward and soonest future expiry", () => {
        const result = computeRewardSortValue(
            [
                reward({ referrer: referrer(5), expiresAt: iso(2000) }),
                reward({ referrer: referrer(20), expiresAt: iso(1000) }),
                reward({ referrer: referrer(10), expiresAt: null }),
            ],
            NOW
        );
        expect(result).toEqual({
            rewardValue: 20,
            soonestExpiry: nowMs + 1000,
        });
    });

    test("expired campaigns are dropped from the expiry, reward still counts", () => {
        const result = computeRewardSortValue(
            [
                reward({ referrer: referrer(5), expiresAt: iso(-1000) }),
                reward({ referrer: referrer(8), expiresAt: iso(1000) }),
            ],
            NOW
        );
        expect(result).toEqual({
            rewardValue: 8,
            soonestExpiry: nowMs + 1000,
        });
    });

    test("all-expired → reward counts but no expiry", () => {
        const result = computeRewardSortValue(
            [reward({ referrer: referrer(5), expiresAt: iso(-1000) })],
            NOW
        );
        expect(result).toEqual({ rewardValue: 5, soonestExpiry: null });
    });

    test("expiry exactly at now is excluded (strictly future only)", () => {
        const result = computeRewardSortValue(
            [reward({ referrer: referrer(5), expiresAt: iso(0) })],
            NOW
        );
        expect(result).toEqual({ rewardValue: 5, soonestExpiry: null });
    });

    test("absent/null expiresAt → no expiry", () => {
        expect(
            computeRewardSortValue([reward({ referrer: referrer(3) })], NOW)
        ).toEqual({ rewardValue: 3, soonestExpiry: null });
    });
});
