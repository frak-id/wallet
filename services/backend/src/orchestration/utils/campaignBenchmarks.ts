/**
 * Static benchmarks used by the campaign details endpoint to surface
 * Frak-vs-Meta comparisons and the Frak platform-fee CPA split.
 *
 * These are NOT measured from production data — they exist because the
 * datasets the frontend needs (Meta Ads industry CPA, Frak's own platform
 * fee) are not tracked in Postgres today. Centralising them here keeps
 * the orchestrator readable and gives the product team one file to edit
 * when the numbers move.
 */

/**
 * Industry-average Meta Ads CPA per fiat currency. Used to derive the
 * "you saved €X vs Meta" comparison in the campaign details sheet.
 *
 * Values are rough public benchmarks rounded to whole units — they're a
 * marketing-grade approximation, not an exact match for any specific
 * campaign. Update from Product when the benchmark shifts.
 */
export const META_CPA_BENCHMARK: Record<string, number> = {
    EUR: 83,
    USD: 90,
    GBP: 71,
};

/**
 * Fallback used when the campaign's modal purchase currency isn't in
 * `META_CPA_BENCHMARK`. EUR is the primary launch market.
 */
export const META_CPA_FALLBACK = META_CPA_BENCHMARK.EUR ?? 83;

/**
 * Look up the Meta CPA benchmark for a currency code, falling back to
 * EUR when the currency is unknown or unset.
 */
export function metaCpaForCurrency(currency: string | null): number {
    if (!currency) return META_CPA_FALLBACK;
    return META_CPA_BENCHMARK[currency.toUpperCase()] ?? META_CPA_FALLBACK;
}

/**
 * Share of total reward spend attributed to the Frak platform fee in the
 * CPA breakdown chart. `asset_logs.recipient_type` only stores `referrer`
 * and `referee` today, so the `frak` segment is an overlay derived from
 * total spend rather than a sum of real rows. When the platform fee
 * becomes a real on-chain split, replace this with a SUM on a new
 * `recipient_type = 'platform'` filter.
 */
export const PLATFORM_FEE_PCT = 0.2;
