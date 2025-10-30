import { isRunningLocally } from "@frak-labs/app-essentials";
import { createServerFn } from "@tanstack/react-start";
import type { SessionOptions } from "iron-session";
import { sealData, unsealData } from "iron-session";
import { type Hex, keccak256, toHex } from "viem";
import {
    parseSiweMessage,
    validateSiweMessage,
    verifySiweMessage,
} from "viem/siwe";
import { viemClient } from "@/context/blockchain/provider";
import type { AuthSession, AuthSessionClient } from "@/types/AuthSession";

/**
 * Session configuration for iron-session
 * Must match backend's expected format
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
 * Helper to get cookie value from request
 */
function getCookie(request: Request, name: string): string | undefined {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
        const [cookieName, ...cookieValue] = cookie.split("=");
        if (cookieName === name) {
            return cookieValue.join("=");
        }
    }
    return undefined;
}

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
 * Helper to build a delete cookie header
 */
function buildDeleteCookieHeader(
    name: string,
    options: Pick<SessionOptions["cookieOptions"], "domain" | "path"> = {}
): string {
    const cookieParts = [
        `${name}=`,
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ];

    if (options.domain) cookieParts.push(`Domain=${options.domain}`);
    if (options.path) cookieParts.push(`Path=${options.path}`);

    return cookieParts.join("; ");
}

/**
 * Set the session for the user after SIWE authentication
 * Validates the SIWE message and signature before creating session
 */
export const setSession = createServerFn({ method: "POST" })
    .inputValidator((input: { message: string; signature: Hex }) => input)
    .handler(async (ctx) => {
        const { message, signature } = ctx.data;

        // Parse the siwe message
        const siweMessage = parseSiweMessage(message);
        if (!siweMessage?.address) {
            throw new Error("Invalid siwe message");
        }

        // Ensure the siwe message is valid
        const host = ctx.request.headers.get("host") ?? "";
        const isValid = validateSiweMessage({
            message: siweMessage,
            domain: host,
        });
        if (!isValid) {
            console.error("Invalid SIWE message", { siweMessage });
            throw new Error("Invalid siwe message");
        }

        // Ensure the siwe message match the given signature
        const isValidSignature = await verifySiweMessage(viemClient, {
            message,
            signature,
        });
        if (!isValidSignature) {
            console.error("Invalid SIWE signature", {
                signature,
                message,
                formattedHash: keccak256(toHex(message)),
            });
            throw new Error("Invalid signature");
        }

        // Build the session data
        const sessionData: AuthSession = {
            wallet: siweMessage.address,
            siwe: {
                message,
                signature,
            },
        };

        // Seal the session data using iron-session
        const sealed = await sealData(sessionData, {
            password: sessionOptions.password,
            ttl: sessionOptions.ttl,
        });

        // Calculate max-age for cookie (ttl - 60s as per iron-session convention)
        const maxAge = sessionOptions.ttl ? sessionOptions.ttl - 60 : undefined;

        // Build the Set-Cookie header
        const setCookieHeader = buildSetCookieHeader(
            sessionOptions.cookieName,
            sealed,
            {
                ...sessionOptions.cookieOptions,
                maxAge,
            }
        );

        // Return a Response with the Set-Cookie header
        // TanStack Start will use this to set the cookie
        return new Response(null, {
            status: 200,
            headers: {
                "Set-Cookie": setCookieHeader,
            },
        });
    });

/**
 * Delete the current session
 */
export const deleteSession = createServerFn({ method: "POST" }).handler(
    async () => {
        const deleteCookieHeader = buildDeleteCookieHeader(
            sessionOptions.cookieName,
            {
                domain: sessionOptions.cookieOptions?.domain,
                path: sessionOptions.cookieOptions?.path,
            }
        );

        return new Response(null, {
            status: 200,
            headers: {
                "Set-Cookie": deleteCookieHeader,
            },
        });
    }
);

/**
 * Get the current session
 * Validates session expiration
 * Note: Cannot clear invalid sessions from here as we can't return both data and Response
 * Invalid sessions should be cleared by calling deleteSession explicitly
 */
export const getSession = createServerFn({ method: "GET" }).handler(
    async (ctx): Promise<AuthSessionClient | null> => {
        // Get the session cookie
        const sealed = getCookie(ctx.request, sessionOptions.cookieName);
        if (!sealed) {
            return null;
        }

        // Unseal the session data
        let session: AuthSession;
        try {
            session = await unsealData<AuthSession>(sealed, {
                password: sessionOptions.password,
                ttl: sessionOptions.ttl,
            });
        } catch (error) {
            console.error("Failed to unseal session:", error);
            // Session is invalid - caller should call deleteSession to clear it
            return null;
        }

        if (!session.wallet || !session.siwe?.message) {
            return null;
        }

        const message = parseSiweMessage(session.siwe.message);
        if (!message) {
            // Invalid message format
            return null;
        }

        // Check if session has expired
        if (
            !message.expirationTime ||
            message.expirationTime.getTime() < Date.now()
        ) {
            // Session expired
            return null;
        }

        return {
            wallet: session.wallet,
        };
    }
);

/**
 * Get the session or throw an error if not authenticated
 * Use this in protected server functions that require authentication
 */
export const getSafeSession = createServerFn({ method: "GET" }).handler(
    async () => {
        const session = await getSession();
        if (!session) {
            throw new Error("No current session found");
        }
        return session;
    }
);
