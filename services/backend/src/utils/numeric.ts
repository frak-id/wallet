/**
 * Numeric coercion + guarded ratios for SQL aggregate results.
 *
 * Postgres returns `numeric` and large counts as strings via the
 * postgres.js driver; both helpers collapse `null`, `undefined` and
 * non-finite values to `0` so downstream JSON serialisation never
 * trips Elysia's TypeBox `t.Number()` validator (`AllowNaN` defaults
 * to false — a single NaN escaping a response handler turns the whole
 * endpoint into a 422).
 */

export function toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Guarded division — returns `0` when the denominator is zero or
 * either operand is non-finite. Centralises the
 * `denom > 0 ? num / denom : 0` pattern used by every derived ratio
 * (CPA, ROI, sharing rate, conversion %, etc.).
 */
export function safeRatio(num: number, denom: number): number {
    if (!denom || !Number.isFinite(num) || !Number.isFinite(denom)) return 0;
    const value = num / denom;
    return Number.isFinite(value) ? value : 0;
}
