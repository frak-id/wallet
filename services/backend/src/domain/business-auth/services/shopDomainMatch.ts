/**
 * Does `domain` match `shopDomain`, allowing either side to be a subdomain of
 * the other on a `.` boundary (design doc §4.10)? Used to decide whether a
 * Shopify SSO session's proven shop domain can vouch for the domain being
 * registered — e.g. the SSO shop is `my-store.myshopify.com` and the merchant
 * registers `shop.my-brand.com` (custom domain), or vice versa.
 *
 * Exact match and dot-boundary suffix match only — never a bare substring/TLD
 * suffix (`example.com` must not match `notexample.com`).
 */
export function matchesShopDomain(domain: string, shopDomain: string): boolean {
    const a = normalize(domain);
    const b = normalize(shopDomain);
    if (a === b) return true;
    return isSubdomainOf(a, b) || isSubdomainOf(b, a);
}

function normalize(host: string): string {
    return host
        .trim()
        .toLowerCase()
        .replace(/^www\./, "");
}

/**
 * Is `sub` a strict subdomain of `base` (dot boundary, not equal)? `base`
 * must itself contain a dot — a single-label base (`"com"`) is a bare TLD,
 * never an acceptable match target.
 */
function isSubdomainOf(sub: string, base: string): boolean {
    return (
        base.includes(".") &&
        sub.length > base.length &&
        sub.endsWith(`.${base}`)
    );
}
