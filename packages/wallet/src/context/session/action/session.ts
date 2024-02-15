"use server";

import type { Session } from "@/types/Session";
import { getIronSession } from "iron-session";
import type { SessionOptions } from "iron-session";
import { cookies } from "next/headers";

/**
 * Options used to store the session in the cookies
 */
const sessionOptions: SessionOptions = {
    password: process.env.SESSION_ENCRYPTION_KEY ?? "",
    cookieName: "session",
    ttl: 60 * 60 * 24 * 7, // 1 week
    cookieOptions: {
        secure: true,
    },
};

/**
 * Get the full session from the cookies
 */
async function getFullSession() {
    // @ts-ignore
    return await getIronSession<Session>(cookies(), sessionOptions);
}

/**
 * Set the session for the user
 * TODO: Should be protected so it can only be called from the server
 * @param username
 * @param wallet
 */
export async function setSession({ username, wallet }: Session) {
    const session = await getFullSession();

    session.username = username;
    session.wallet = wallet;

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
export async function getSession(): Promise<Session | null> {
    const session = await getFullSession();
    if (!session.username) return null;

    return {
        username: session.username,
        wallet: session.wallet,
    };
}
