import { currentStablecoins, type Stablecoin } from "@frak-labs/app-essentials";
import Decimal from "decimal.js";
import type { Address } from "viem";
import { isAddressEqual } from "viem";

/**
 * VAT + Frak fee + withdraw-restitution math (billing-feature-plan.md §4).
 *
 * Pure, side-effect-free, no DB/cross-domain imports — safe to unit test in
 * isolation and safe to call directly from the orchestrator. All money in/out
 * is a decimal STRING: Drizzle returns `numeric` columns as strings, and
 * `parseFloat`/native `number` arithmetic loses precision on large amounts,
 * so every step goes through `decimal.js`.
 *
 * Output strings are fixed at 18 decimal places (`numeric(36,18)` scale, same
 * as `asset_logs`/`billing_documents` columns) so values round-trip losslessly
 * through Postgres and stay deterministic regardless of input precision.
 */

const MONEY_SCALE = 18;
const FR_VAT_RATE = "0.20";
const FRAK_FEE_RATE = "0.20";

/**
 * Reverse of `getTokenAddressForStablecoin` (only the forward direction
 * exists in `@frak-labs/app-essentials`). Reward asset logs store a token
 * address, not a currency code, so the monthly-bill ledger needs this to
 * fold reward sums into a per-currency ledger row (§6.2). Built once,
 * module-level — `currentStablecoins` is a small fixed const, not a DB read.
 * Address comparison via `isAddressEqual` (checksum-safe), never string `===`.
 */
const STABLECOIN_ENTRIES = Object.entries(currentStablecoins) as [
    Stablecoin,
    Address,
][];

/**
 * Maps a reward token address back to its `Stablecoin` currency, or
 * `undefined` if the token isn't one of the current stablecoins (e.g. a
 * legacy/non-stablecoin reward token). Non-stablecoin tokens must never be
 * folded into the fiat ledger — they have no `Stablecoin` currency to key a
 * ledger row on and would corrupt per-currency sums; they're annex-only.
 */
export function stablecoinForTokenAddress(
    tokenAddress: Address
): Stablecoin | undefined {
    return STABLECOIN_ENTRIES.find(([, address]) =>
        isAddressEqual(address, tokenAddress)
    )?.[0];
}

function toMoneyString(value: Decimal): string {
    return value.toFixed(MONEY_SCALE);
}

function assertNonNegativeFiniteDecimal(value: string, label: string): Decimal {
    let decimal: Decimal;
    try {
        decimal = new Decimal(value);
    } catch {
        throw new Error(`${label} is not a valid decimal string: "${value}"`);
    }
    if (!decimal.isFinite()) {
        throw new Error(`${label} must be finite, got "${value}"`);
    }
    if (decimal.isNegative()) {
        throw new Error(`${label} must be non-negative, got "${value}"`);
    }
    return decimal;
}

export type DepositComputationInput = {
    /** Decimal string, VAT-inclusive amount the merchant deposited. */
    grossAmount: string;
    /** ISO-3166 alpha-2. Only "FR" triggers VAT (§4). */
    country: string;
};

export type DepositComputationResult = {
    vatAmount: string;
    frakFeeAmount: string;
    netAmount: string;
};

export type WithdrawComputationInput = {
    /** Decimal string, amount still on the campaign bank at withdraw time. */
    remainingBankAmount: string;
    /** `netAmount` column of the linked deposit. */
    linkedDepositNetAmount: string;
    /** `details.vatAmount` of the linked deposit. */
    linkedDepositVatAmount: string;
    /** `details.frakFeeAmount` of the linked deposit. */
    linkedDepositFrakFeeAmount: string;
    /** Sum of settled reward amounts since the linked deposit's `documentDate`. */
    rewardsDistributedSinceDeposit: string;
};

export type WithdrawComputationResult = {
    /** 0..1, clamped. */
    distributedRatio: string;
    restitutedVat: string;
    restitutedFrakFee: string;
    bankSent: string;
};

export type MonthlyLedgerInput = {
    /** Sum of `net_amount` for deposits before `periodStart`. */
    depositedBefore: string;
    /** Sum of `details.bankSent` for withdraws before `periodStart`. */
    withdrawnBefore: string;
    /** Sum of settled reward amounts (this currency's token) before `periodStart`. */
    rewardedBefore: string;
    /** Sum of `net_amount` for deposits within `[periodStart, periodEnd)`. */
    depositedInPeriod: string;
    /** Sum of `details.bankSent` for withdraws within `[periodStart, periodEnd)`. */
    withdrawnInPeriod: string;
    /** Sum of settled reward amounts within `[periodStart, periodEnd)`. */
    rewardedInPeriod: string;
};

export type MonthlyLedgerResult = {
    openingBalance: string;
    closingBalance: string;
    totalDeposited: string;
    totalWithdrawn: string;
    totalRewarded: string;
};

export type DivergenceAssessment = {
    deltaAbs: string;
    withinThreshold: boolean;
};

export type AnnexRowFiatInput = {
    /** Decimal string, already token-scaled (not wei). */
    amount: string;
    /** Spot price at read time (§6.3 — the one place a float is allowed in). */
    price: { eur: number; usd: number; gbp: number };
};

export type AnnexRowFiatResult = {
    eur: string;
    usd: string;
    gbp: string;
};

// Divergence threshold: flag when the absolute delta exceeds both a fixed
// floor (dust from spot-price/precision noise never flags) AND a relative
// percentage of the derived balance (billing-feature-plan.md §6.2).
const DIVERGENCE_ABS_FLOOR = "1";
const DIVERGENCE_REL_PCT = "0.01";

export class BillingComputationService {
    /**
     * Deposit note math — VAT extracted from a VAT-inclusive gross amount,
     * Frak fee taken on the VAT-exclusive base (§4).
     *
     * ```
     * vatRate       = country === "FR" ? 0.20 : 0
     * vatAmount     = grossAmount * vatRate / (1 + vatRate)
     * frakFeeAmount = (grossAmount - vatAmount) * 0.20
     * netAmount     = grossAmount - vatAmount - frakFeeAmount
     * ```
     */
    computeDeposit({
        grossAmount,
        country,
    }: DepositComputationInput): DepositComputationResult {
        const gross = assertNonNegativeFiniteDecimal(
            grossAmount,
            "grossAmount"
        );

        const vatRate =
            country === "FR" ? new Decimal(FR_VAT_RATE) : new Decimal(0);
        const vatAmount = vatRate.isZero()
            ? new Decimal(0)
            : gross.mul(vatRate).div(new Decimal(1).plus(vatRate));

        const feeBase = gross.minus(vatAmount);
        const frakFeeAmount = feeBase.mul(FRAK_FEE_RATE);
        const netAmount = gross.minus(vatAmount).minus(frakFeeAmount);

        return {
            vatAmount: toMoneyString(vatAmount),
            frakFeeAmount: toMoneyString(frakFeeAmount),
            netAmount: toMoneyString(netAmount),
        };
    }

    /**
     * Withdraw bill math — pro-rata restitution of the linked deposit's VAT
     * and Frak fee, based on how much of that deposit's net amount has
     * actually been distributed as rewards since (§4).
     *
     * ```
     * distributedRatio  = clamp(rewardsDistributedSinceDeposit / linkedDeposit.netAmount, 0, 1)
     * restitutedFrakFee = linkedDeposit.frakFeeAmount * (1 - distributedRatio)
     * restitutedVat     = linkedDeposit.vatAmount     * (1 - distributedRatio)
     * bankSent          = remainingBankAmount + restitutedFrakFee + restitutedVat
     * ```
     */
    computeWithdraw({
        remainingBankAmount,
        linkedDepositNetAmount,
        linkedDepositVatAmount,
        linkedDepositFrakFeeAmount,
        rewardsDistributedSinceDeposit,
    }: WithdrawComputationInput): WithdrawComputationResult {
        const remaining = assertNonNegativeFiniteDecimal(
            remainingBankAmount,
            "remainingBankAmount"
        );
        const linkedNet = assertNonNegativeFiniteDecimal(
            linkedDepositNetAmount,
            "linkedDepositNetAmount"
        );
        const linkedVat = assertNonNegativeFiniteDecimal(
            linkedDepositVatAmount,
            "linkedDepositVatAmount"
        );
        const linkedFrakFee = assertNonNegativeFiniteDecimal(
            linkedDepositFrakFeeAmount,
            "linkedDepositFrakFeeAmount"
        );
        const distributed = assertNonNegativeFiniteDecimal(
            rewardsDistributedSinceDeposit,
            "rewardsDistributedSinceDeposit"
        );

        // Guard divide-by-zero: net 0 => treat as fully distributed, no
        // restitution (a zero-net deposit had zero VAT/fee to begin with, so
        // this is also the value-preserving choice, not just a fallback).
        const rawRatio = linkedNet.isZero()
            ? new Decimal(1)
            : distributed.div(linkedNet);
        // Defensive belt-and-suspenders bound: inputs are already validated
        // non-negative, so rawRatio can't be < 0 in practice.
        const distributedRatio = Decimal.min(
            Decimal.max(rawRatio, new Decimal(0)),
            new Decimal(1)
        );

        const undistributedRatio = new Decimal(1).minus(distributedRatio);
        const restitutedFrakFee = linkedFrakFee.mul(undistributedRatio);
        const restitutedVat = linkedVat.mul(undistributedRatio);
        const bankSent = remaining.plus(restitutedFrakFee).plus(restitutedVat);

        return {
            distributedRatio: toMoneyString(distributedRatio),
            restitutedVat: toMoneyString(restitutedVat),
            restitutedFrakFee: toMoneyString(restitutedFrakFee),
            bankSent: toMoneyString(bankSent),
        };
    }

    /**
     * Defensive backend re-mask (§3.5). The frontend already obfuscates the
     * IBAN before sending it, but this normalizes any inbound IBAN-shaped
     * string to keep only the country code + last 3 digits, so a client that
     * sends more than it should never gets persisted verbatim. Never throws —
     * odd/short input is fully redacted rather than leaked.
     */
    maskIban(raw: string): string {
        const normalized = raw.replace(/\s+/g, "").toUpperCase();

        // Too short to safely carry a country code + last digits without
        // risking exposing most of the value — redact entirely.
        if (normalized.length < 8) {
            return "**** **** **** ****";
        }

        const countryCode = normalized.slice(0, 2);
        const lastDigits = normalized.slice(-3);
        return `${countryCode} **** **** **** ${lastDigits}`;
    }

    /**
     * Folds pre-summed deposit/withdraw/reward totals into one currency's
     * opening/closing fiat ledger for a monthly bill (§6.2). All inputs are
     * already-aggregated decimal strings (grouped SQL sums); this method only
     * folds them — no date/boundary logic here (that lives in the SQL layer,
     * half-open `[periodStart, periodEnd)`).
     *
     * ```
     * openingBalance = depositedBefore - withdrawnBefore - rewardedBefore
     * closingBalance = openingBalance + depositedInPeriod - withdrawnInPeriod - rewardedInPeriod
     * ```
     *
     * Negative balances are valid output (an admin-entry-incomplete ledger is
     * a real possibility, not a bug — §6.2) and are never clamped.
     * `closingBalance` is defined as `openingBalance + in-period movement`,
     * so the two always reconcile by construction; correctness instead
     * depends on callers passing consistent half-open date boundaries to the
     * SQL sums (§6.2 — see `MonthlyBillOrchestrator`).
     */
    computeMonthlyLedger({
        depositedBefore,
        withdrawnBefore,
        rewardedBefore,
        depositedInPeriod,
        withdrawnInPeriod,
        rewardedInPeriod,
    }: MonthlyLedgerInput): MonthlyLedgerResult {
        const openingBalance = new Decimal(depositedBefore)
            .minus(withdrawnBefore)
            .minus(rewardedBefore);

        const totalDeposited = new Decimal(depositedInPeriod);
        const totalWithdrawn = new Decimal(withdrawnInPeriod);
        const totalRewarded = new Decimal(rewardedInPeriod);

        const closingBalance = openingBalance
            .plus(totalDeposited)
            .minus(totalWithdrawn)
            .minus(totalRewarded);

        return {
            openingBalance: toMoneyString(openingBalance),
            closingBalance: toMoneyString(closingBalance),
            totalDeposited: toMoneyString(totalDeposited),
            totalWithdrawn: toMoneyString(totalWithdrawn),
            totalRewarded: toMoneyString(totalRewarded),
        };
    }

    /**
     * Compares the derived closing balance (from admin-entered deposits/
     * withdraws + settled rewards) against a live on-chain balance snapshot
     * (§6.2). Both inputs must already be in the SAME human-decimal unit —
     * callers reading an on-chain `bigint` balance MUST scale it by the
     * token's decimals (`bigint / 10^decimals`) before calling this; comparing
     * a raw bigint to a human decimal would "diverge" by ~10^decimals every
     * time and is the single most likely bug in this flow.
     *
     * Flags when the absolute delta exceeds both a fixed floor (dust never
     * flags) AND a relative percentage of the derived balance.
     */
    assessDivergence(
        derivedClosing: string,
        onChainBalance: string
    ): DivergenceAssessment {
        const derived = new Decimal(derivedClosing);
        const onChain = new Decimal(onChainBalance);
        const deltaAbs = derived.minus(onChain).abs();

        const threshold = Decimal.max(
            new Decimal(DIVERGENCE_ABS_FLOOR),
            derived.abs().mul(DIVERGENCE_REL_PCT)
        );

        return {
            deltaAbs: toMoneyString(deltaAbs),
            withinThreshold: deltaAbs.lessThanOrEqualTo(threshold),
        };
    }

    /**
     * Converts one already-token-scaled reward amount to fiat at a given spot
     * price (monthly-bill reward annex, §6.1/§6.3). The ONLY float input
     * permitted anywhere in billing money math is the spot `price` itself
     * (disclosed limitation, §6.3) — the multiplication and every value that
     * gets summed or frozen afterwards must go through decimal.js strings,
     * never native float accumulation.
     */
    annexRowFiat({ amount, price }: AnnexRowFiatInput): AnnexRowFiatResult {
        const decimalAmount = new Decimal(amount);
        return {
            eur: toMoneyString(decimalAmount.mul(price.eur)),
            usd: toMoneyString(decimalAmount.mul(price.usd)),
            gbp: toMoneyString(decimalAmount.mul(price.gbp)),
        };
    }
}
