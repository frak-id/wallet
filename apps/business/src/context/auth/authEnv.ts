/**
 * Isomorphic auth functions using TanStack Start's environment functions
 * These work on both server (reads from cookies) and client (reads from store)
 */

import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { type JWTPayload, jwtVerify } from "jose";
import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

/**
 * Get the auth token
 * Server: reads from cookie
 * Client: reads from Zustand store
 */
export const getAuthToken = createIsomorphicFn()
    .server(() => {
        return getCookie("business-auth");
    })
    .client(() => {
        return useAuthStore.getState().token;
    });

/**
 * Check if in demo mode
 * Server: checks if token equals "demo-token"
 * Client: reads from Zustand store
 */
export const isDemoMode = createIsomorphicFn()
    .server(() => {
        const token = getCookie("business-auth");
        return token === "demo-token";
    })
    .client(() => {
        return useAuthStore.getState().token === "demo-token";
    });

/**
 * Get the wallet address
 * Server: parses from JWT or returns demo address
 * Client: reads from Zustand store
 */
export const getWallet = createIsomorphicFn()
    .server(async (): Promise<Address | null> => {
        const token = getCookie("business-auth");

        if (!token) {
            return null;
        }

        // Demo mode
        if (token === "demo-token") {
            return "0x0000000000000000000000000000000000000001" as Address;
        }

        // Parse JWT
        try {
            const secret = new TextEncoder().encode(
                process.env.JWT_BUSINESS_SECRET
            );
            const { payload } = await jwtVerify<
                JWTPayload & { wallet: Address }
            >(token, secret);
            return payload.wallet;
        } catch {
            return null;
        }
    })
    .client(() => {
        return useAuthStore.getState().wallet;
    });
