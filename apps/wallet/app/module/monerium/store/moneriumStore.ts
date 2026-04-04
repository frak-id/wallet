import { create } from "zustand";
import { persist } from "zustand/middleware";

type MoneriumStoreState = {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null;
    pendingCodeVerifier: string | null;
    hasSeenSetupSuccess: boolean;

    setTokens: (access: string, refresh: string, expiresIn: number) => void;
    setPendingCodeVerifier: (verifier: string | null) => void;
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
            hasSeenSetupSuccess: false,

            setTokens: (access, refresh, expiresIn) =>
                set({
                    accessToken: access,
                    refreshToken: refresh,
                    tokenExpiry: Date.now() + expiresIn * 1000,
                }),
            setPendingCodeVerifier: (pendingCodeVerifier) =>
                set({ pendingCodeVerifier }),
            markSetupSuccessSeen: () => set({ hasSeenSetupSuccess: true }),
            disconnect: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    tokenExpiry: null,
                    pendingCodeVerifier: null,
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

export const isMoneriumTokenExpired = (state: MoneriumStoreState) =>
    state.tokenExpiry !== null && Date.now() >= state.tokenExpiry;
