/**
 * Client-only auth functions
 * All functions read from Zustand store (localStorage-backed)
 */

import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

/**
 * Get the auth token from store
 */
export function getAuthToken(): string | null {
    return useAuthStore.getState().token;
}

/**
 * Check if in demo mode
 */
export function isDemoMode(): boolean {
    return useAuthStore.getState().token === "demo-token";
}

/**
 * Get the wallet address from store
 */
export function getWallet(): Address | null {
    return useAuthStore.getState().wallet;
}
