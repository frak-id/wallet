import { jwtVerify } from "jose";
import type { ShopifySessionToken } from "../../domain/auth/models/ShopifySessionDto";
import { log } from "./logger";

const CLOCK_TOLERANCE_SECONDS = 10;

/**
 * Verify a Shopify session token JWT (HS256, signed by Shopify with the app's API secret).
 * Returns the decoded payload or null if validation fails.
 *
 * Validation steps:
 *  1. Verify HS256 signature using SHOPIFY_API_SECRET
 *  2. Check exp/nbf with 10s clock tolerance
 *  3. Check aud matches SHOPIFY_CLIENT_ID
 *  4. Check iss and dest domains match
 */
export async function verifyShopifySessionToken(
    token: string
): Promise<ShopifySessionToken | null> {
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!clientId || !apiSecret) {
        log.warn(
            "Shopify JWT validation skipped — missing SHOPIFY_CLIENT_ID or SHOPIFY_API_SECRET"
        );
        return null;
    }

    const secret = new TextEncoder().encode(apiSecret);

    try {
        const { payload } = await jwtVerify<ShopifySessionToken>(
            token,
            secret,
            {
                algorithms: ["HS256"],
                clockTolerance: CLOCK_TOLERANCE_SECONDS,
                audience: clientId,
            }
        );

        // Validate iss and dest domains match
        const issDomain = extractHostname(payload.iss);
        const destDomain = extractHostname(payload.dest);
        if (!issDomain || !destDomain || issDomain !== destDomain) {
            log.warn(
                { iss: payload.iss, dest: payload.dest },
                "Shopify JWT iss/dest domain mismatch"
            );
            return null;
        }

        return payload;
    } catch (error) {
        log.debug(
            { error: error instanceof Error ? error.message : "unknown" },
            "Shopify JWT verification failed"
        );
        return null;
    }
}

/**
 * Extract the shop domain from the Shopify JWT `dest` claim.
 * e.g. "https://mystore.myshopify.com" → "mystore.myshopify.com"
 */
export function extractShopDomain(dest: string): string | null {
    return extractHostname(dest);
}

function extractHostname(url: string): string | null {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}
