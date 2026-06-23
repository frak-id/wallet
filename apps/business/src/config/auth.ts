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
 * Check if in demo mode.
 *
 * Non-reactive: reads the store directly so route loaders (which can't
 * call React hooks) can build query keys. Components should use
 * `useIsDemoMode()` instead — it subscribes to the store.
 *
 * Mismatch is safe across a demo toggle: `useDemoMode().setDemoMode`
 * calls `queryClient.invalidateQueries()` which evicts any prefetched
 * data keyed on the old mode, so the rendered component always refetches
 * with the current value.
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
