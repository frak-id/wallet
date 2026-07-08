import type { MerchantAccountingInfo } from "@frak-labs/backend-elysia/domain/merchant";

/**
 * Billing domain shapes. Backed by the `/:merchantId/billing/accounting` and
 * `/:merchantId/billing/documents` endpoints (see `useBillingInfo.ts`).
 */

/**
 * Invoice address / company details used on generated billing documents.
 * Aliased to the backend TypeBox static type so the field set can't drift from
 * `MerchantAccountingInfoSchema`. This is the fully-required form shape; the
 * accounting GET returns `Partial<MerchantAccountingInfo>`.
 */
export type BillingInfo = MerchantAccountingInfo;

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
