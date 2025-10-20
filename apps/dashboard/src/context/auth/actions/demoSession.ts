"use server";

import { isRunningLocally } from "@frak-labs/app-essentials";
import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import type { Address, Hex } from "viem";

/**
 * Hardcoded demo wallet address (from mock campaign data)
 */
const DEMO_WALLET_ADDRESS: Address =
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";

/**
 * Options used to store the session in the cookies
 */
const sessionOptions: SessionOptions = {
    password: process.env.SESSION_ENCRYPTION_KEY ?? "",
    cookieName: "businessSession",
    ttl: 60 * 60 * 24 * 7, // 1 week
    cookieOptions: {
        secure: true,
        sameSite: "none",
        domain: isRunningLocally ? "localhost" : ".frak.id",
    },
};

/**
 * Activate demo mode by setting the demo mode cookie
 */
export async function activateDemoMode() {
    const cookieStore = await cookies();

    // Set demo mode cookie
    cookieStore.set("business_demoMode", "true", {
        path: "/",
        maxAge: 31536000, // 1 year
        sameSite: "lax",
        secure: true,
        domain: isRunningLocally ? "localhost" : ".frak.id",
    });
}

/**
 * Create a demo session without SIWE verification
 * This bypasses the normal authentication flow for demo purposes
 */
export async function setDemoSession() {
    // Only allow in development/localhost for security
    if (!isRunningLocally) {
        throw new Error("Demo session only available in development");
    }

    // Create a mock SIWE message
    const expirationTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 1 week
    const issuedAt = new Date();

    const mockSiweMessage = `localhost:3001 wants you to sign in with your Ethereum account:
${DEMO_WALLET_ADDRESS}

Demo Mode Session

URI: https://localhost:3001
Version: 1
Chain ID: 1
Nonce: demo-nonce-${Date.now()}
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expirationTime.toISOString()}`;

    // Mock signature (not a real signature, just for demo)
    const mockSignature: Hex =
        "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    // Get session and save demo data
    const session = await getIronSession<{
        wallet: Address;
        siwe: { message: string; signature: Hex };
    }>(await cookies(), sessionOptions);

    session.wallet = DEMO_WALLET_ADDRESS;
    session.siwe = {
        message: mockSiweMessage,
        signature: mockSignature,
    };

    await session.save();
}
