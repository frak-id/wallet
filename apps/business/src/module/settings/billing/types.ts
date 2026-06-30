/**
 * Billing domain shapes. UI-first: the values are currently served by the
 * `useBillingInfo` stub. TODO: replace with the Eden Treaty (`@frak-labs/client`)
 * billing contract once the backend exists.
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

/** A billing-history line. `kind` drives the table tag (Paid vs Deposit). */
export type BillingEntry = {
    id: string;
    /** ISO date string, formatted for display in the table. */
    date: string;
    /** Amount in euros (formatted as currency at render time). */
    amount: number;
    kind: "invoice" | "deposit";
    description: string;
};
