import { isRunningInProd, isRunningLocally } from "@frak-labs/app-essentials";
import { createServerFn } from "@tanstack/react-start";
import type { SessionOptions } from "iron-session";
import { sealData } from "iron-session";
import type { Address, Hex } from "viem";
import type { AuthSession } from "@/types/AuthSession";

/**
 * Hardcoded demo wallet address (from mock campaign data)
 */
const DEMO_WALLET_ADDRESS: Address =
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";

/**
 * Session configuration for iron-session (must match session.ts)
 */
const sessionOptions: SessionOptions = {
    password: process.env.SESSION_ENCRYPTION_KEY ?? "",
    cookieName: "businessSession",
    ttl: 60 * 60 * 24 * 7, // 1 week
    cookieOptions: {
        secure: !isRunningLocally,
        sameSite: "lax",
        domain: isRunningLocally ? undefined : ".frak.id",
        httpOnly: true,
        path: "/",
    },
};

/**
 * Helper to build a Set-Cookie header value
 */
function buildSetCookieHeader(
    name: string,
    value: string,
    options: SessionOptions["cookieOptions"] & { maxAge?: number } = {}
): string {
    const cookieParts = [`${name}=${value}`];

    if (options.httpOnly) cookieParts.push("HttpOnly");
    if (options.secure) cookieParts.push("Secure");
    if (options.sameSite) cookieParts.push(`SameSite=${options.sameSite}`);
    if (options.domain) cookieParts.push(`Domain=${options.domain}`);
    if (options.path) cookieParts.push(`Path=${options.path}`);
    if (options.maxAge !== undefined)
        cookieParts.push(`Max-Age=${options.maxAge}`);

    return cookieParts.join("; ");
}

/**
 * Create demo session with mock authentication
 * Only allowed in development and staging
 */
export const createDemoSession = createServerFn({ method: "POST" })
    .inputValidator((input: undefined) => input)
    .handler(async (ctx) => {
        // Block in production
        if (isRunningInProd) {
            throw new Error("Demo mode not available in production");
        }

        const host = ctx.request.headers.get("host") ?? "localhost:3022";
        const protocol = isRunningLocally ? "http" : "https";
        const origin = `${protocol}://${host}`;

        // Create mock SIWE message following EIP-4361 format
        const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
        const issuedAt = new Date();

        const mockSiweMessage = `${host} wants you to sign in with your Ethereum account:
${DEMO_WALLET_ADDRESS}

Demo Mode Session

URI: ${origin}
Version: 1
Chain ID: 1
Nonce: demo${Date.now()}
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expirationTime.toISOString()}`;

        const mockSignature: Hex =
            "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

        // Build the session data
        const sessionData: AuthSession = {
            wallet: DEMO_WALLET_ADDRESS,
            siwe: {
                message: mockSiweMessage,
                signature: mockSignature,
            },
        };

        // Seal the session data using iron-session
        const sealed = await sealData(sessionData, {
            password: sessionOptions.password,
            ttl: sessionOptions.ttl,
        });

        // Calculate max-age for session cookie
        const maxAge = sessionOptions.ttl ? sessionOptions.ttl - 60 : undefined;

        // Build Set-Cookie headers for both session and demo mode
        const sessionCookieHeader = buildSetCookieHeader(
            sessionOptions.cookieName,
            sealed,
            {
                ...sessionOptions.cookieOptions,
                maxAge,
            }
        );

        const demoModeCookieHeader = buildSetCookieHeader(
            "business_demoMode",
            "true",
            {
                path: "/",
                maxAge: 31536000, // 1 year
                sameSite: "lax",
                httpOnly: false,
            }
        );

        // Return Response with both Set-Cookie headers
        return new Response(null, {
            status: 200,
            headers: [
                ["Set-Cookie", sessionCookieHeader],
                ["Set-Cookie", demoModeCookieHeader],
            ],
        });
    });
