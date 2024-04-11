"use server";

import type { AdminSession } from "@/type/AdminSession";
import { type SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";

/**
 * Options used to store the session in the cookies
 */
const sessionOptions: SessionOptions = {
    password: process.env.SESSION_ENCRYPTION_KEY ?? "",
    cookieName: "admin-session",
    ttl: 60 * 60 * 24, // 1 day
    cookieOptions: {
        secure: true,
    },
};

/**
 * Get the full session from the cookies
 */
async function getFullSession() {
    // @ts-ignore
    return await getIronSession<AdminSession>(cookies(), sessionOptions);
}

/**
 * Check if the current user is admin
 *   - Admin role is used to add articles
 */
export async function isAdmin() {
    const currentSession = await getFullSession();
    return currentSession.isAdmin ?? false;
}

/**
 * Small function to lock the usage to admin only people
 */
export async function onlyAdmin() {
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
        throw new Error("You are not an admin");
    }
}

/**
 * Try to login as an admin
 * @param password
 */
export async function performAdminLogin(password: string) {
    if (password !== process.env.ADMIN_PASSWORD) {
        throw new Error("Invalid password");
    }

    const session = await getFullSession();
    session.isAdmin = true;
    await session.save();
}

/**
 * Delete the current session
 */
export async function deleteSession() {
    const session = await getFullSession();
    session.destroy();
}
