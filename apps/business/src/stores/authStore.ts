import type { Address } from "viem";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pushCreationStore } from "@/stores/pushCreationStore";

export type BusinessAuthMethod = "siwe" | "password" | "shopify";

type AuthState = {
    token: string | null;
    wallet: Address | null;
    accountId: string | null;
    authMethod: BusinessAuthMethod | null;
    expiresAt: number | null;
    /** Session minted but 2FA not yet completed — unusable outside `/auth`. */
    pending2fa: boolean;
    setAuth: (auth: {
        token: string;
        wallet?: Address | null;
        accountId?: string | null;
        authMethod?: BusinessAuthMethod;
        expiresAt: number;
        pending2fa?: boolean;
    }) => void;
    setWallet: (wallet: Address) => void;
    clearAuth: () => void;
    isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            wallet: null,
            accountId: null,
            authMethod: null,
            expiresAt: null,
            pending2fa: false,

            setAuth: ({
                token,
                wallet = null,
                accountId = null,
                authMethod = "siwe",
                expiresAt,
                pending2fa = false,
            }) => {
                set({
                    token,
                    wallet,
                    accountId,
                    authMethod,
                    expiresAt,
                    pending2fa,
                });
            },

            setWallet: (wallet) => {
                set({ wallet });
            },

            clearAuth: () => {
                // Clear store
                set({
                    token: null,
                    wallet: null,
                    accountId: null,
                    authMethod: null,
                    expiresAt: null,
                    pending2fa: false,
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
                const { token, expiresAt, pending2fa } = get();
                if (!token || !expiresAt) return false;
                if (pending2fa) return false;
                return Date.now() < expiresAt;
            },
        }),
        {
            name: "business-auth",
            // Tolerate the pre-account-model persisted shape
            // (`{ token, wallet, expiresAt }`, no `accountId`/`authMethod`/
            // `pending2fa`): the store's own defaults backfill the missing
            // fields, so an old session just resumes as a wallet-only SIWE
            // session on next load.
            version: 1,
            migrate: (persistedState) => {
                const state = (persistedState ?? {}) as Partial<AuthState>;
                return {
                    ...state,
                    accountId: state.accountId ?? null,
                    authMethod:
                        state.authMethod ?? (state.wallet ? "siwe" : null),
                    pending2fa: state.pending2fa ?? false,
                };
            },
        }
    )
);

/**
 * Current session token for the `x-business-auth` header, or null when
 * absent/expired. Deliberately NOT gated on `isAuthenticated()`: a
 * pending-2FA session is unauthenticated for routing purposes but its token
 * MUST still be sent — the whole `/auth/2fa/*` surface runs on pending
 * sessions (`allowPending: true`).
 */
export function getSafeAuthToken(): string | null {
    const { token, expiresAt } = useAuthStore.getState();
    if (!token || !expiresAt || Date.now() >= expiresAt) {
        return null;
    }
    return token;
}
