import { t } from "@backend-utils";

/**
 * Schema for Shopify session token JWT payload.
 *
 * These tokens are signed by Shopify (HS256) with the app's API secret.
 * They contain shop identity (dest) and user identity (sub) but NO wallet address.
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 */
export const ShopifySessionTokenDto = t.Object({
    /** Issuer — shop admin URL (e.g. "https://mystore.myshopify.com/admin") */
    iss: t.String(),
    /** Destination — shop URL without /admin (e.g. "https://mystore.myshopify.com") */
    dest: t.String(),
    /** Audience — the Shopify app's client_id (API key) */
    aud: t.String(),
    /** Subject — Shopify user ID */
    sub: t.String(),
    /** Expiration time (UNIX seconds) */
    exp: t.Number(),
    /** Not before (UNIX seconds) */
    nbf: t.Number(),
    /** Issued at (UNIX seconds) */
    iat: t.Number(),
    /** Unique token ID (UUID) */
    jti: t.String(),
    /** Session ID (per user+app) */
    sid: t.String(),
    /** Shopify signature (optional in some token versions) */
    sig: t.Optional(t.String()),
});

export type ShopifySessionToken = typeof ShopifySessionTokenDto.static;
