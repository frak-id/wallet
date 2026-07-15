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

/**
 * Build a link into the business dashboard that goes through the Shopify SSO
 * login entrypoint rather than a bare deep link to a guarded route.
 *
 * `target` is the relative path (beginning with `/`) inside the business app
 * that the merchant should land on once authenticated — e.g.
 * `/m/<merchantId>/dashboard`. When the shop domain is known, `/login/shopify`
 * attempts an invisible (or one-click) Shopify SSO before redirecting to
 * `target`. Without a shop domain, this falls back to the generic `/login`
 * route, which still honors `redirect` once the user picks a login method.
 */
export function buildBusinessDashboardUrl({
    businessUrl,
    shop,
    target,
}: {
    businessUrl: string;
    shop: string | undefined | null;
    target: string;
}): string {
    if (shop) {
        const params = new URLSearchParams({ shop, redirect: target });
        return `${businessUrl}/login/shopify?${params.toString()}`;
    }
    const params = new URLSearchParams({ redirect: target });
    return `${businessUrl}/login?${params.toString()}`;
}
