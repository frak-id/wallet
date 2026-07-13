/**
 * Input DTO for `BillingPdfService.render`. Assembled by the orchestrator
 * (cross-domain reads happen there — this service is domain-pure and never
 * touches the DB or another domain). All money fields are the *frozen*
 * decimal strings already computed by `BillingComputationService` — this
 * service only formats them for display, it never recomputes.
 */
export type BillingPdfDocumentDto = {
    kind: "deposit" | "withdraw" | "monthly_bill";
    reference: string;
    documentDate: Date;
    currency: string;
    /** Not meaningful for `monthly_bill` (multi-currency; use `monthlyBill.ledgers`). */
    grossAmount: string;
    /** Not meaningful for `monthly_bill` (multi-currency; use `monthlyBill.ledgers`). */
    netAmount: string;
    /** The merchant being billed. May be partial/empty if accounting info was never filled in. */
    buyer: {
        companyName?: string;
        vatNumber?: string;
        addressLines: string[];
    };
    /** Present when `kind === "deposit"`. */
    deposit?: {
        vatAmount: string;
        frakFeeAmount: string;
        /** Offered top-up added back to the net (§4); absent/"0" when none. */
        giftedAmount?: string;
        note?: string;
        paymentPlatform?: string;
    };
    /** Present when `kind === "withdraw"`. */
    withdraw?: {
        remainingBankAmount: string;
        distributedRatio: string;
        restitutedVat: string;
        restitutedFrakFee: string;
        bankSent: string;
        maskedIban: string;
        note?: string;
    };
    /** Present when `kind === "monthly_bill"`. */
    monthlyBill?: {
        periodStart: Date;
        periodEnd: Date;
        /**
         * Whether French VAT applies to this merchant (country === "FR").
         * When false, the reward table shows a 0% rate and the recap's TVA is
         * 0 (TTC === HT) — reverse-charge / autoliquidation, same rule as the
         * deposit/withdraw VAT lines.
         */
        vatApplicable: boolean;
        ledgers: Array<{
            currency: string;
            openingBalance: string;
            closingBalance: string;
            totalDeposited: string;
            totalWithdrawn: string;
            totalRewarded: string;
        }>;
        fiatTotals: { eur: string; usd: string; gbp: string };
        /**
         * Per-line settled STABLECOIN rewards in the period — re-queried at
         * render time (§3.2), not stored in `details`. `currency` is always
         * a known stablecoin; non-stablecoin reward rows go to
         * `otherRewards` instead and never enter invoice totals.
         */
        annexRows: Array<{
            settledAt: Date;
            amount: string;
            currency: string;
            fiatValue: string;
            txHash?: string;
        }>;
        /**
         * Settled rewards in non-stablecoin tokens — rendered as a purely
         * informational "hors facturation" section (token amount only, no
         * fiat value, excluded from every billed total).
         */
        otherRewards?: Array<{
            settledAt: Date;
            amount: string;
            txHash?: string;
        }>;
    };
};
