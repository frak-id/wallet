/**
 * Does `domain` match `shopDomain` (design doc §4.10)? Used to decide whether a
 * Shopify SSO session's proven shop domain can vouch for the domain being
 * registered — e.g. the SSO shop is `my-store.myshopify.com` and the merchant
 * registers `checkout.my-store.myshopify.com` (a subdomain of the proven shop).
 *
 * Direction matters and is intentionally asymmetric: only the *registering*
 * domain may be the shop domain itself or a subdomain of it. The reverse
 * (shop domain being a subdomain of the registering domain) is NOT accepted
 * — otherwise an attacker who controls `attacker.myshopify.com` could
 * "vouch for" the domain `myshopify.com` itself (every real shop is a
 * subdomain of `myshopify.com`), bypassing DNS verification for any store.
 *
 * Exact match and dot-boundary suffix match only — never a bare substring/TLD
 * suffix (`example.com` must not match `notexample.com`).
 */
export function matchesShopDomain(domain: string, shopDomain: string): boolean {
    const a = normalize(domain);
    const b = normalize(shopDomain);
    if (a === b) return true;
    return isSubdomainOf(a, b);
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
