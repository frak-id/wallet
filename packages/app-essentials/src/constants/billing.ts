/**
 * Deposit billing rates shared by the backend deposit bills and the merchant
 * dashboards, which gross the on-chain (net) bank balance back up for display.
 */
const BPS_DENOMINATOR = 10_000;

export const BILLING_RATES = {
    /** French VAT, extracted from a VAT-inclusive deposit. */
    FR_VAT_BPS: 2_000,
    /** Frak fee, taken on the VAT-exclusive deposit base. */
    FRAK_FEE_BPS: 2_000,
    BPS_DENOMINATOR,
} as const;

export function bpsToPercent(bps: number): number {
    return (bps * 100) / BPS_DENOMINATOR;
}

/** Only FR-domiciled merchants are charged VAT; others are reverse-charged. */
export function isVatApplicable(country: string | null | undefined): boolean {
    return country === "FR";
}

export type BankBalanceBreakdown = {
    /** What the merchant paid for this balance: VAT and Frak fee included. */
    gross: bigint;
    vat: bigint;
    frakFee: bigint;
    /** The on-chain balance, i.e. what end users can still receive. */
    distributable: bigint;
};

/**
 * Inverse of the deposit bill math: the bank only holds the net amount, so
 * `gross = net / (1 - fee) * (1 + vat)`. Gifted top-ups get grossed up too.
 */
export function grossUpBankBalance(
    distributable: bigint,
    vatApplicable: boolean
): BankBalanceBreakdown {
    const denominator = BigInt(BPS_DENOMINATOR);
    const feeBps = BigInt(BILLING_RATES.FRAK_FEE_BPS);
    const vatBps = vatApplicable ? BigInt(BILLING_RATES.FR_VAT_BPS) : 0n;

    const exclVat = (distributable * denominator) / (denominator - feeBps);
    const gross = (exclVat * (denominator + vatBps)) / denominator;

    return {
        gross,
        vat: gross - exclVat,
        frakFee: exclVat - distributable,
        distributable,
    };
}
