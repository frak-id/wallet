import { create } from "zustand";
import { persist } from "zustand/middleware";

type MoneriumStoreState = {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null;
    /**
     * PKCE verifier and CSRF state nonce, generated together at the start of
     * the OAuth redirect and consumed when the callback returns. Stored as
     * a pair so we can never use one without validating the other.
     */
    pendingCodeVerifier: string | null;
    pendingState: string | null;
    hasSeenSetupSuccess: boolean;

    setTokens: (access: string, refresh: string, expiresIn: number) => void;
    setPendingAuth: (verifier: string, state: string) => void;
    clearPendingAuth: () => void;
    markSetupSuccessSeen: () => void;
    disconnect: () => void;
};

export const moneriumStore = create<MoneriumStoreState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            pendingCodeVerifier: null,
            pendingState: null,
            hasSeenSetupSuccess: false,

            setTokens: (access, refresh, expiresIn) =>
                set({
                    accessToken: access,
                    refreshToken: refresh,
                    tokenExpiry: Date.now() + expiresIn * 1000,
                }),
            setPendingAuth: (verifier, state) =>
                set({
                    pendingCodeVerifier: verifier,
                    pendingState: state,
                }),
            clearPendingAuth: () =>
                set({ pendingCodeVerifier: null, pendingState: null }),
            markSetupSuccessSeen: () => set({ hasSeenSetupSuccess: true }),
            disconnect: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    tokenExpiry: null,
                    pendingCodeVerifier: null,
                    pendingState: null,
                    hasSeenSetupSuccess: false,
                }),
        }),
        {
            name: "frak_monerium_store",
        }
    )
);

export const isMoneriumConnected = (state: MoneriumStoreState) =>
    state.accessToken !== null;
