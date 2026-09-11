/**
 * Client-only auth functions
 * All functions read from Zustand store (localStorage-backed)
 */

import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

export function getAuthToken(): string | null {
    return useAuthStore.getState().token;
}

/**
 * Non-reactive read for route loaders, which cannot call hooks; components use
 * `useIsDemoMode()`. A mismatch across a toggle is safe — `setDemoMode`
 * invalidates every query, so the component refetches with the current value.
 */
export function isDemoMode(): boolean {
    return useAuthStore.getState().token === "demo-token";
}

export function getWallet(): Address | null {
    return useAuthStore.getState().wallet;
}
