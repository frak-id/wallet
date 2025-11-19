import type { Address } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
    token: string | null;
    wallet: Address | null;
    expiresAt: number | null;
    setAuth: (token: string, wallet: Address, expiresAt: number) => void;
    clearAuth: () => void;
    isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            wallet: null,
            expiresAt: null,

            setAuth: (token, wallet, expiresAt) =>
                set({ token, wallet, expiresAt }),

            clearAuth: () =>
                set({ token: null, wallet: null, expiresAt: null }),

            isAuthenticated: () => {
                const { token, expiresAt } = get();
                if (!token || !expiresAt) return false;
                return Date.now() < expiresAt;
            },
        }),
        {
            name: "business-auth",
        }
    )
);

/**
 * Get the current session token safely
 */
export function getSafeAuthToken(): string | null {
    const state = useAuthStore.getState();
    if (!state.isAuthenticated()) {
        return null;
    }
    return state.token;
}

/**
 * Get the current session data safely
 */
export function getSafeAuthSession(): {
    token: string;
    wallet: Address;
} | null {
    const state = useAuthStore.getState();
    if (!state.isAuthenticated() || !state.wallet) {
        return null;
    }
    return { token: state.token!, wallet: state.wallet };
}
