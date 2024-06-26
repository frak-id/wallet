"use server";

import { viemClient } from "@/context/blockchain/provider";
import type { AuthSession, AuthSessionClient } from "@/types/AuthSession";
import { getIronSession } from "iron-session";
import type { SessionOptions } from "iron-session";
import { cookies, headers } from "next/headers";
import { type Hex, keccak256, toHex } from "viem";
import {
    parseSiweMessage,
    validateSiweMessage,
    verifySiweMessage,
} from "viem/siwe";

/**
 * Options used to store the session in the cookies
 */
const sessionOptions: SessionOptions = {
    password: process.env.SESSION_ENCRYPTION_KEY ?? "",
    cookieName: "business.frak.session",
    ttl: 60 * 60 * 24 * 7, // 1 week
    cookieOptions: {
        secure: true,
    },
};

/**
 * Get the full session from the cookies
 */
async function getFullSession() {
    return await getIronSession<AuthSession>(cookies(), sessionOptions);
}

/**
 * Set the session for the user
 * @param wallet
 */
export async function setSession({
    message,
    signature,
}: { message: string; signature: Hex }) {
    // Parse the siwe message
    const siweMessage = parseSiweMessage(message);
    if (!siweMessage?.address) {
        throw new Error("Invalid siwe message");
    }

    // Ensure the siwe message is valid
    const isValid = validateSiweMessage({
        message: siweMessage,
        domain: headers().get("host") ?? "",
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
    const session = await getFullSession();
    session.wallet = siweMessage.address;
    session.siwe = {
        message: message,
        signature,
    };
    await session.save();
}

/**
 * Delete the current session
 */
export async function deleteSession() {
    const session = await getFullSession();
    session.destroy();
}

/**
 * Get the current session
 */
export async function getSession(): Promise<AuthSessionClient | null> {
    const session = await getFullSession();
    if (!session.wallet) return null;

    // todo: siwe check every 2 hours??

    return {
        wallet: session.wallet,
    };
}
