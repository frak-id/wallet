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
 */
export function redirectToShopifyAuthorize(shop: string): void {
    const url = new URL("/business/auth/shopify/authorize", backendBaseUrl);
    url.searchParams.set("shop", shop.trim());
    window.location.href = url.toString();
}
