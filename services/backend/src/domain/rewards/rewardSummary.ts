import type { TokenPrice } from "@backend-infrastructure";
import type {
    FiatAmounts,
    PendingRewardSummary,
    RewardSummary,
} from "@frak-labs/core-sdk";
import Decimal from "decimal.js";
import type { Address } from "viem";
import type { AssetLogRecipientType, AssetStatus } from "./schemas";

export type MerchantRewardRow = {
    status: AssetStatus;
    amount: string;
    tokenAddress: Address;
    recipientType: AssetLogRecipientType;
    availableAt: Date | null;
    held: boolean;
    expiresAt: Date | null;
};

type FiatTotals = { eur: Decimal; usd: Decimal; gbp: Decimal };

const UNPAID_STATUSES: readonly AssetStatus[] = [
    "pending",
    "processing",
    "bank_depleted",
];
const DEADLINE_STATUSES: readonly AssetStatus[] = ["pending", "bank_depleted"];

function emptyTotals(): FiatTotals {
    return { eur: new Decimal(0), usd: new Decimal(0), gbp: new Decimal(0) };
}

function addRow(totals: FiatTotals, row: MerchantRewardRow, price: TokenPrice) {
    const amount = new Decimal(row.amount);
    totals.eur = totals.eur.add(amount.mul(price.eur));
    totals.usd = totals.usd.add(amount.mul(price.usd));
    totals.gbp = totals.gbp.add(amount.mul(price.gbp));
}

function toFiatAmounts(totals: FiatTotals): FiatAmounts {
    return {
        eurAmount: totals.eur.toDecimalPlaces(2).toNumber(),
        usdAmount: totals.usd.toDecimalPlaces(2).toNumber(),
        gbpAmount: totals.gbp.toDecimalPlaces(2).toNumber(),
    };
}

function isZero({ eurAmount, usdAmount, gbpAmount }: FiatAmounts): boolean {
    return eurAmount === 0 && usdAmount === 0 && gbpAmount === 0;
}

function earliest(dates: Date[]): string | null {
    if (dates.length === 0) return null;
    const first = Math.min(...dates.map((date) => date.getTime()));
    return new Date(first).toISOString();
}

function summarizePending(
    rows: MerchantRewardRow[],
    prices: Map<string, TokenPrice>,
    now: Date
): PendingRewardSummary | null {
    if (rows.length === 0) return null;

    const total = emptyTotals();
    const cashback = emptyTotals();
    const fromFriends = emptyTotals();
    let lockedCount = 0;
    const upcomingUnlocks: Date[] = [];

    for (const row of rows) {
        const price = prices.get(row.tokenAddress);
        if (!price) continue;
        addRow(total, row, price);
        addRow(
            row.recipientType === "referrer" ? fromFriends : cashback,
            row,
            price
        );
        const unlocksLater = row.availableAt && row.availableAt > now;
        if (row.held || unlocksLater) lockedCount++;
        if (row.availableAt && unlocksLater) {
            upcomingUnlocks.push(row.availableAt);
        }
    }

    const totalAmounts = toFiatAmounts(total);
    if (isZero(totalAmounts)) return null;

    return {
        total: totalAmounts,
        cashback: toFiatAmounts(cashback),
        fromFriends: toFiatAmounts(fromFriends),
        count: rows.length,
        lockedCount,
        nextUnlockAt: earliest(upcomingUnlocks),
        expiresAt: earliest(
            rows
                .filter((row) => DEADLINE_STATUSES.includes(row.status))
                .flatMap((row) => (row.expiresAt ? [row.expiresAt] : []))
        ),
    };
}

/**
 * Rows whose token has no price are dropped entirely. Unpaid rows already past
 * `expiresAt` are dropped too (the daily sweep may not have cancelled them
 * yet); settled rows keep their creation-time `expiresAt` and always count.
 */
export function summarizeMerchantRewards(params: {
    rows: MerchantRewardRow[];
    prices: Map<string, TokenPrice | undefined>;
    linked: boolean;
    now: Date;
}): RewardSummary {
    const { linked, now } = params;
    const prices = new Map<string, TokenPrice>();
    for (const [token, price] of params.prices) {
        if (price) prices.set(token, price);
    }
    const priced = params.rows.filter((row) => prices.has(row.tokenAddress));

    const settled = emptyTotals();
    for (const row of priced) {
        const price = prices.get(row.tokenAddress);
        if (row.status === "settled" && price) addRow(settled, row, price);
    }
    const earnedTotal = toFiatAmounts(settled);

    return {
        linked,
        pending: summarizePending(
            priced.filter(
                (row) =>
                    UNPAID_STATUSES.includes(row.status) &&
                    (!row.expiresAt || row.expiresAt > now)
            ),
            prices,
            now
        ),
        earned: linked && !isZero(earnedTotal) ? { total: earnedTotal } : null,
    };
}
