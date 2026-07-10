/**
 * Check if a URL is absolute (http, https, mailto, tel).
 */
export function isAbsoluteUrl(url: string): boolean {
    return /^(https?|mailto|tel):/.test(url);
}

/**
 * Parse a charge_id string to a number. Returns null if invalid.
 */
export function parseChargeId(rawChargeId: string | null): number | null {
    if (!rawChargeId) return null;
    const chargeId = Number.parseInt(rawChargeId, 10);
    if (Number.isNaN(chargeId)) return null;
    return chargeId;
}
