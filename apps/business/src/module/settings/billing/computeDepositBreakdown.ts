/**
 * Client-side mirror of the backend deposit math
 * (`BillingComputationService.computeDeposit`, billing-feature-plan.md §4),
 * for a live, DISPLAY-ONLY preview in `AddDepositSheet`. The server recomputes
 * authoritatively on submit — these numbers only guide the operator and are
 * never persisted, so `number` arithmetic (rounded for display) is fine here
 * rather than the backend's 18-dp `decimal.js`.
 *
 * ```
 * vatRate       = country === "FR" ? 0.20 : 0
 * vatAmount     = gross * vatRate / (1 + vatRate)   // VAT extracted from a VAT-inclusive gross
 * frakFeeAmount = (gross - vatAmount) * 0.20
 * netAmount     = gross - vatAmount - frakFeeAmount
 * ```
 */

const FR_VAT_RATE = 0.2;
const FRAK_FEE_RATE = 0.2;

export type DepositBreakdown = {
    gross: number;
    vat: number;
    frakFee: number;
    net: number;
    /** True only for FR — elsewhere VAT is 0 (§4). Drives the VAT-row label. */
    vatApplies: boolean;
};

/**
 * Breakdown for a raw gross amount + country, or `null` when the gross input
 * isn't yet a usable non-negative number (empty/partial/invalid) — callers
 * render nothing in that case.
 */
export function computeDepositBreakdown(
    grossAmount: string,
    country: string
): DepositBreakdown | null {
    if (!grossAmount.trim()) return null;
    const gross = Number(grossAmount);
    if (!Number.isFinite(gross) || gross < 0) return null;

    const vatApplies = country === "FR";
    const vatRate = vatApplies ? FR_VAT_RATE : 0;
    const vat = vatRate === 0 ? 0 : (gross * vatRate) / (1 + vatRate);
    const frakFee = (gross - vat) * FRAK_FEE_RATE;
    const net = gross - vat - frakFee;

    return { gross, vat, frakFee, net, vatApplies };
}
