import type { TokenPrice } from "@backend-infrastructure";
import { describe, expect, it } from "vitest";
import {
    type MerchantRewardRow,
    summarizeMerchantRewards,
} from "./rewardSummary";

const NOW = new Date("2026-06-01T00:00:00Z");
const EURE = "0x00000000000000000000000000000000000000e1";
const NO_PRICE = "0x00000000000000000000000000000000000000f1";
const PRICES = new Map<string, TokenPrice | undefined>([
    [EURE, { eur: 1, usd: 1.1, gbp: 0.85 }],
]);
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY);

function row(overrides: Partial<MerchantRewardRow> = {}): MerchantRewardRow {
    return {
        status: "pending",
        amount: "1",
        tokenAddress: EURE,
        recipientType: "referee",
        availableAt: null,
        held: false,
        expiresAt: inDays(30),
        ...overrides,
    };
}

function summarize(rows: MerchantRewardRow[], linked = false) {
    return summarizeMerchantRewards({ rows, prices: PRICES, linked, now: NOW });
}

describe("summarizeMerchantRewards", () => {
    it("returns nothing pending and nothing earned without rows", () => {
        expect(summarize([])).toEqual({
            linked: false,
            pending: null,
            earned: null,
        });
    });

    it("ignores rows already past their expiry", () => {
        const summary = summarize([
            row({ expiresAt: inDays(-1) }),
            row({ expiresAt: NOW }),
        ]);

        expect(summary.pending).toBeNull();
    });

    it("counts pending, processing and bank_depleted rows as pending", () => {
        const summary = summarize([
            row({ status: "pending" }),
            row({ status: "processing" }),
            row({ status: "bank_depleted" }),
            row({ status: "settled" }),
        ]);

        expect(summary.pending?.count).toBe(3);
        expect(summary.pending?.total.eurAmount).toBe(3);
    });

    it("splits friend rewards from cashback", () => {
        const summary = summarize([
            row({ recipientType: "referrer", amount: "2" }),
            row({ recipientType: "referee", amount: "1.5" }),
            row({ recipientType: "welcome_bonus", amount: "0.5" }),
        ]);

        expect(summary.pending?.fromFriends.eurAmount).toBe(2);
        expect(summary.pending?.cashback.eurAmount).toBe(2);
        expect(summary.pending?.total.eurAmount).toBe(4);
    });

    it("converts to every currency and rounds to 2 decimals", () => {
        const summary = summarize([row({ amount: "1.234" })]);

        expect(summary.pending?.total).toEqual({
            eurAmount: 1.23,
            usdAmount: 1.36,
            gbpAmount: 1.05,
        });
    });

    it("excludes a row whose token has no price from every figure", () => {
        const summary = summarize([
            row({ amount: "1" }),
            row({
                amount: "9",
                tokenAddress: NO_PRICE,
                held: true,
                availableAt: inDays(1),
                expiresAt: inDays(2),
            }),
        ]);

        expect(summary.pending).toMatchObject({
            count: 1,
            lockedCount: 0,
            nextUnlockAt: null,
            expiresAt: inDays(30).toISOString(),
        });
        expect(summary.pending?.total.eurAmount).toBe(1);
    });

    it("has no pending summary when only unpriced rows are pending", () => {
        const summary = summarize([row({ tokenAddress: NO_PRICE })]);

        expect(summary.pending).toBeNull();
    });

    it("has no pending summary when the rounded total is zero", () => {
        expect(summarize([row({ amount: "0.001" })]).pending).toBeNull();
    });

    it("has no earned total when only unpriced or dust rows settled", () => {
        const rows = [
            row({ status: "settled", tokenAddress: NO_PRICE }),
            row({ status: "settled", amount: "0.001" }),
        ];

        expect(summarize(rows, true).earned).toBeNull();
    });

    it("still counts settled rows past their creation-time expiry", () => {
        const summary = summarize(
            [row({ status: "settled", amount: "4", expiresAt: inDays(-200) })],
            true
        );

        expect(summary.earned?.total.eurAmount).toBe(4);
    });

    it("counts held and not-yet-available rows as locked", () => {
        const summary = summarize([
            row({ held: true }),
            row({ availableAt: inDays(3) }),
            row({ availableAt: inDays(-1) }),
            row(),
        ]);

        expect(summary.pending?.lockedCount).toBe(2);
    });

    it("reports the earliest future unlock", () => {
        const summary = summarize([
            row({ availableAt: inDays(5) }),
            row({ availableAt: inDays(2) }),
            row({ availableAt: inDays(-4) }),
        ]);

        expect(summary.pending?.nextUnlockAt).toBe(inDays(2).toISOString());
    });

    it("has no next unlock when nothing is locked by time", () => {
        expect(summarize([row()]).pending?.nextUnlockAt).toBeNull();
    });

    it("reports the earliest expiry of pending and bank_depleted rows only", () => {
        const summary = summarize([
            row({ expiresAt: inDays(20) }),
            row({ status: "bank_depleted", expiresAt: inDays(10) }),
            row({ status: "processing", expiresAt: inDays(2) }),
        ]);

        expect(summary.pending?.expiresAt).toBe(inDays(10).toISOString());
    });

    it("has no expiry when no row carries a deadline", () => {
        expect(
            summarize([row({ expiresAt: null })]).pending?.expiresAt
        ).toBeNull();
    });

    it("reports settled rows as earned only once linked", () => {
        const rows = [row({ status: "settled", amount: "4" })];

        expect(summarize(rows, true).earned).toEqual({
            total: { eurAmount: 4, usdAmount: 4.4, gbpAmount: 3.4 },
        });
        expect(summarize(rows, false).earned).toBeNull();
        expect(summarize([row()], true).earned).toBeNull();
    });
});
