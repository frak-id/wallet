/**
 * Pure assembly helpers shared by `BillingOrchestrator` and
 * `MonthlyBillOrchestrator`. Lives in its own module so neither orchestrator
 * imports the other (orchestrator → orchestrator is not an allowed flow —
 * both docstrings promise "neither calls the other").
 */

/**
 * Builds the PDF `buyer` block from a merchant's `accountingInfo` (shared by
 * every billing document kind — deposit/withdraw/monthly_bill — so both
 * `BillingOrchestrator` and `MonthlyBillOrchestrator` assemble it the same
 * way). `accountingInfo` is a `Partial<MerchantAccountingInfo>`, so every
 * field is optional — an unfilled-in merchant still gets a (mostly blank)
 * buyer block rather than a crash (§3.1).
 */
export function buildPdfBuyer(accountingInfo: {
    companyName?: string;
    vatNumber?: string;
    streetAddress?: string;
    postalCode?: string;
    city?: string;
    country?: string;
}): {
    companyName?: string;
    vatNumber?: string;
    addressLines: string[];
} {
    return {
        companyName: accountingInfo.companyName,
        vatNumber: accountingInfo.vatNumber,
        addressLines: [
            accountingInfo.streetAddress,
            [accountingInfo.postalCode, accountingInfo.city]
                .filter(Boolean)
                .join(" "),
            // ISO-3166 alpha-2 code as its own trailing line — the merchant's
            // country is now merchant-editable (§3.1) and belongs on the
            // buyer block of the legal document.
            accountingInfo.country,
        ].filter((line): line is string => Boolean(line)),
    };
}
