/**
 * Billing domain shapes. Backed by the `/:merchantId/billing/accounting` and
 * `/:merchantId/billing/documents` endpoints (see `useBillingInfo.ts`).
 */

/** Invoice address / company details used on generated billing documents. */
export type BillingInfo = {
    companyName: string;
    vatNumber: string;
    streetAddress: string;
    city: string;
    postalCode: string;
    /** ISO-3166 alpha-2 country code (display name resolved via countries.ts). */
    country: string;
    billingEmail: string;
};

/**
 * A billing-history line, derived from a `BillingDocumentResponse`.
 * `kind` drives the table tag (Paid vs Deposit) and which tab it's listed
 * under; `monthly_bill` documents become "invoice" rows, `deposit`/`withdraw`
 * documents become "deposit" rows.
 */
export type BillingEntry = {
    /** Underlying billing document id — used to fetch the PDF. */
    id: string;
    /** ISO date string (the document's `documentDate`), formatted for display. */
    date: string;
    /**
     * Gross amount, for DISPLAY only (parsed from the backend's decimal
     * string). `null` when the document has no gross amount (shouldn't
     * happen for deposit/withdraw/monthly_bill, but the column is nullable).
     */
    amount: number | null;
    /** Stablecoin currency code (not an ISO-4217 code — never format as Intl currency). */
    currency: string;
    kind: "invoice" | "deposit";
    /** Human-facing reference, e.g. "DEP-2026-0001". */
    reference: string;
    description: string;
    /** Whether the PDF has been generated and is downloadable. */
    hasPdf: boolean;
    /**
     * The underlying document kind, unmapped — needed to route a void
     * action to the right admin endpoint (`deposits/:id` vs
     * `withdrawals/:id`). Monthly bills have no void route.
     */
    rawKind: "deposit" | "withdraw" | "monthly_bill";
};
