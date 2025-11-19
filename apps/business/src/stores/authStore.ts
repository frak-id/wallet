import type { Address } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearAuthCookie, setAuthCookie } from "@/utils/cookies";

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

            setAuth: (token, wallet, expiresAt) => {
                // Update store
                set({ token, wallet, expiresAt });

                // Sync with cookie for SSR
                setAuthCookie(token, expiresAt);
            },

            clearAuth: () => {
                // Clear store
                set({
                    token: null,
                    wallet: null,
                    expiresAt: null,
                });

                // Clear cookie
                clearAuthCookie();
            },

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
