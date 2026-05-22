import type { Address } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pushCreationStore } from "@/stores/pushCreationStore";

type AuthState = {
    token: string | null;
    wallet: Address | null;
    expiresAt: number | null;
    setAuth: (token: string, wallet: Address, expiresAt: number) => void;
    clearAuth: () => void;
    isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            wallet: null,
            expiresAt: null,

            setAuth: (token, wallet, expiresAt) => {
                // Update store
                set({ token, wallet, expiresAt });
            },

            clearAuth: () => {
                // Clear store
                set({
                    token: null,
                    wallet: null,
                    expiresAt: null,
                });
                // Wipe transient stores that hold draft data the next
                // user (or unauthenticated viewer) shouldn't see — the
                // push composition can carry targeting + payload data.
                // Other persisted stores (campaign draft, members
                // filters) are merchant-scoped and access-checked by
                // the layout loader, so they stay put for now.
                pushCreationStore.getState().clearForm();
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
