import { backendBaseUrl } from "@/api/backendClient";

/** `my-store.myshopify.com` — mirrors the backend's `isValidShopDomain` regex. */
const SHOP_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function isValidShopDomain(shop: string): boolean {
    return SHOP_DOMAIN_PATTERN.test(shop.trim());
}

/**
 * Full-page redirect into the backend-driven Shopify OAuth flow (§4.7).
 * Not an Eden call: `/auth/shopify/authorize` itself issues a 302 to
 * Shopify, so the browser must navigate there directly.
 *
 * `redirect` is an optional same-origin relative target (validated on the
 * receiving end by `safeRedirectTarget`) carried through the OAuth `state`
 * so the callback can land the user on the page they originally wanted
 * (e.g. a Shopify-app deep-link into a specific campaign) instead of always
 * defaulting to `/dashboard`.
 */
export function redirectToShopifyAuthorize(
    shop: string,
    redirect?: string
): void {
    const url = new URL("/business/auth/shopify/authorize", backendBaseUrl);
    url.searchParams.set("shop", shop.trim());
    if (redirect) {
        url.searchParams.set("redirect", redirect);
    }
    window.location.href = url.toString();
}
