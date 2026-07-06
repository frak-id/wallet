import Decimal from "decimal.js";

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
}
