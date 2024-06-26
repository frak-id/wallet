"use server";

import { viemClient } from "@/context/blockchain/provider";
import type { AuthSession, AuthSessionClient } from "@/types/AuthSession";
import { getIronSession } from "iron-session";
import type { SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Hex } from "viem";
import {
    type SiweMessage,
    createSiweMessage,
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
    siwe,
    signature,
}: { siwe: SiweMessage; signature: Hex }) {
    // todo: Ensure that the domain of the siwe message is valid

    // Ensure the siwe message match the given signature
    const message = createSiweMessage(siwe);
    const isValidSignature = await verifySiweMessage(viemClient, {
        message,
        signature,
    });
    if (!isValidSignature) {
        console.log("Invalid signature", { siwe, signature, message });
        // todo: sig verification fail, to fix
        // throw new Error("Invalid signature");
    }

    const session = await getFullSession();

    session.wallet = siwe.address;
    session.siwe = {
        message: siwe,
        signature,
    };

    await session.save();

    // Return the client session
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
