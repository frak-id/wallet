import { hmac } from "@oslojs/crypto/hmac";
import { SHA256 } from "@oslojs/crypto/sha2";
import { constantTimeEqual } from "@oslojs/crypto/subtle";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { OAuth2Client } from "arctic";

const SHOP_DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export type ShopifyAssociatedUser = {
    id: string;
    email: string | null;
    accountOwner: boolean;
};

/**
 * Identity granted by a Shopify OAuth online (per-user) token exchange.
 * Only the identity is kept — the access token itself is discarded (§4.7,
 * we never call the Admin API on the user's behalf here).
 */
export type ShopifyIdentity = {
    shopDomain: string;
    associatedUser: ShopifyAssociatedUser;
};

/**
 * Standalone-dashboard Shopify SSO (design doc §4.7) — OAuth authorization
 * code flow with online tokens (`grant_options[]=per-user`), so the identity
 * is the signed-in staff member, not the app's own offline access grant.
 *
 * Deliberately NOT the embedded App Bridge session-token flow
 * (`infrastructure/external/shopifyJwt.ts`) — that one stays untouched and
 * exempt from all of this (§4.11).
 *
 * No arctic built-in provider exists for Shopify (checked: not in
 * `arctic`'s provider list) — built manually on arctic's generic
 * `OAuth2Client` per §3, plus the HMAC query verification arctic doesn't do
 * for any provider.
 */
export class ShopifySsoService {
    /** Shop domain format Shopify issues at the `myshopify.com` level. */
    isValidShopDomain(shop: string): boolean {
        return SHOP_DOMAIN_REGEX.test(shop);
    }

    /**
     * Authorization URL for a given shop. `grant_options[]=per-user` is what
     * makes the resulting token an online (staff-identity) token instead of
     * an offline app-install token — arctic's `createAuthorizationURL` has
     * no first-class support for extra query params, so it's appended after.
     * `OAuth2Client` is endpoint-agnostic (the shop-specific authorize URL is
     * passed per-call), so no per-shop client instance is needed.
     */
    createAuthorizationUrl(params: {
        shop: string;
        callbackUrl: string;
        state: string;
    }): URL {
        const client = new OAuth2Client(
            process.env.SHOPIFY_CLIENT_ID,
            process.env.SHOPIFY_API_SECRET,
            params.callbackUrl
        );
        const url = client.createAuthorizationURL(
            `https://${params.shop}/admin/oauth/authorize`,
            params.state,
            []
        );
        url.searchParams.set("grant_options[]", "per-user");
        return url;
    }

    /**
     * Verify the Shopify callback query HMAC (§4.7 step 4). Shopify signs
     * every query param except `hmac` (and `signature`, a legacy alias) with
     * HMAC-SHA256 of `key1=value1&key2=value2...` sorted by key,
     * unescaped-code-point order — see Shopify's OAuth verification docs.
     */
    verifyCallbackHmac(searchParams: URLSearchParams): boolean {
        const secret = process.env.SHOPIFY_API_SECRET;
        const receivedHex = searchParams.get("hmac");
        if (!secret || !receivedHex) return false;

        const message = [...searchParams.entries()]
            .filter(([key]) => key !== "hmac" && key !== "signature")
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(
                ([key, value]) =>
                    `${escapeAmpAndEqual(key)}=${escapeAmpAndEqual(value)}`
            )
            .join("&");

        const computed = hmac(
            SHA256,
            new TextEncoder().encode(secret),
            new TextEncoder().encode(message)
        );
        const computedHex = encodeHexLowerCase(computed);

        // Length must match before constant-time compare — oslojs asserts
        // equal-length inputs.
        if (computedHex.length !== receivedHex.length) return false;
        return constantTimeEqual(
            new TextEncoder().encode(computedHex),
            new TextEncoder().encode(receivedHex)
        );
    }

    /**
     * Exchange the authorization code for an online token and extract the
     * staff identity. The access token itself is intentionally not returned
     * — we only need `associated_user` (§4.7 notes).
     */
    async exchangeCodeForIdentity(params: {
        shop: string;
        code: string;
        callbackUrl: string;
    }): Promise<ShopifyIdentity | null> {
        const clientId = process.env.SHOPIFY_CLIENT_ID;
        const clientSecret = process.env.SHOPIFY_API_SECRET;
        if (!clientId || !clientSecret) return null;

        // Shopify's token endpoint returns `associated_user` directly in the
        // JSON body (not inside a JWT), which arctic's typed OAuth2Tokens
        // does not model — call it as a raw POST per Shopify's token-exchange
        // spec rather than forcing arctic's client through it.
        const response = await fetch(
            `https://${params.shop}/admin/oauth/access_token`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: params.code,
                }),
            }
        );
        if (!response.ok) return null;

        const body = (await response.json()) as {
            associated_user?: {
                id: number;
                email?: string;
                account_owner?: boolean;
            };
        };
        if (!body.associated_user) return null;

        return {
            shopDomain: params.shop,
            associatedUser: {
                id: String(body.associated_user.id),
                email: body.associated_user.email ?? null,
                accountOwner: body.associated_user.account_owner ?? false,
            },
        };
    }
}

/** Shopify's HMAC message escapes literal `&`, `=` and `%` in keys/values. */
function escapeAmpAndEqual(value: string): string {
    return value.replace(/%/g, "%25").replace(/&/g, "%26").replace(/=/g, "%3D");
}
