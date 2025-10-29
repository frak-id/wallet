import { isRunningLocally } from "@frak-labs/app-essentials";
import { createServerFn } from "@tanstack/react-start";
import {
    clearSession,
    getRequestHost,
    getSession as getStartSession,
    updateSession,
} from "@tanstack/react-start/server";
import { guard } from "radash";
import { type Hex, keccak256, toHex } from "viem";
import {
    parseSiweMessage,
    validateSiweMessage,
    verifySiweMessage,
} from "viem/siwe";
import { viemClient } from "@/context/blockchain/provider";
import type { AuthSession, AuthSessionClient } from "@/types/AuthSession";

/**
 * Session configuration for TanStack Start
 */
export const sessionConfig = {
    password:
        process.env.SESSION_ENCRYPTION_KEY ??
        "development-secret-key-min-32-chars-long!",
    name: "businessSession",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    cookie: {
        secure: !isRunningLocally,
        sameSite: "lax" as const,
        domain: isRunningLocally ? undefined : ".frak.id",
        httpOnly: true,
    },
};

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
        const host = getRequestHost();
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

        // Build the session and save it
        await updateSession<AuthSession>(sessionConfig, {
            wallet: siweMessage.address,
            siwe: {
                message: message,
                signature,
            },
        });
    });

/**
 * Delete the current session
 */
export const deleteSession = createServerFn({ method: "POST" }).handler(
    async () => {
        await clearSession(sessionConfig);
    }
);

/**
 * Get the current session
 * Validates session expiration and clears if expired
 */
export const getSession = createServerFn({ method: "GET" }).handler(
    async (): Promise<AuthSessionClient | null> => {
        const session = await getStartSession<AuthSession>(sessionConfig);

        if (!session.data.wallet || !session.data.siwe?.message) {
            return null;
        }

        const message = parseSiweMessage(session.data.siwe.message);
        if (!message) {
            // Invalid message format - clear session
            await guard(() => clearSession(sessionConfig));
            return null;
        }

        // Check if session has expired
        if (
            !message.expirationTime ||
            message.expirationTime.getTime() < Date.now()
        ) {
            // Session expired - clear it
            await guard(() => clearSession(sessionConfig));
            return null;
        }

        return {
            wallet: session.data.wallet,
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
