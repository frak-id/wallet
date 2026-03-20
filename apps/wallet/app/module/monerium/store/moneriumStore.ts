/**
 * Zustand store for Monerium integration
 * Manages authentication tokens, profile state, and IBAN information
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

type MoneriumStoreState = {
    // Auth tokens
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null; // timestamp ms (Date.now() + expiresIn * 1000)
    profileId: string | null;

    // Profile status
    profileState:
        | "created"
        | "pending"
        | "approved"
        | "rejected"
        | "blocked"
        | null;

    // IBAN info
    iban: string | null;
    ibanLinkedAddress: string | null; // hex address the IBAN is linked to on-chain

    // PKCE state (persisted — needed across OAuth redirect)
    pendingCodeVerifier: string | null;

    // Actions
    setTokens: (
        access: string,
        refresh: string,
        expiresIn: number,
        profileId: string
    ) => void;
    setProfileState: (state: MoneriumStoreState["profileState"]) => void;
    setIban: (iban: string, linkedAddress: string) => void;
    setPendingCodeVerifier: (verifier: string | null) => void;
    disconnect: () => void;
};

/**
 * Monerium store managing authentication, profile, and IBAN state
 * Uses persist middleware to sync with localStorage
 */
export const moneriumStore = create<MoneriumStoreState>()(
    persist(
        (set) => ({
            // Initial state
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            profileId: null,
            profileState: null,
            iban: null,
            ibanLinkedAddress: null,
            pendingCodeVerifier: null,

            // Actions
            setTokens: (access, refresh, expiresIn, profileId) =>
                set({
                    accessToken: access,
                    refreshToken: refresh,
                    tokenExpiry: Date.now() + expiresIn * 1000,
                    profileId,
                }),
            setProfileState: (profileState) => set({ profileState }),
            setIban: (iban, ibanLinkedAddress) =>
                set({ iban, ibanLinkedAddress }),
            setPendingCodeVerifier: (pendingCodeVerifier) =>
                set({ pendingCodeVerifier }),
            disconnect: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    tokenExpiry: null,
                    profileId: null,
                    profileState: null,
                    iban: null,
                    ibanLinkedAddress: null,
                    pendingCodeVerifier: null,
                }),
        }),
        {
            name: "frak_monerium_store",
        }
    )
);

/**
 * Selector functions for individual state fields
 */

// Get the access token
export const selectAccessToken = (state: MoneriumStoreState) =>
    state.accessToken;

// Get the refresh token
export const selectRefreshToken = (state: MoneriumStoreState) =>
    state.refreshToken;

// Get the profile ID
export const selectProfileId = (state: MoneriumStoreState) => state.profileId;

// Get the profile state
export const selectProfileState = (state: MoneriumStoreState) =>
    state.profileState;

// Get the IBAN
export const selectIban = (state: MoneriumStoreState) => state.iban;

// Get the IBAN linked address
export const selectIbanLinkedAddress = (state: MoneriumStoreState) =>
    state.ibanLinkedAddress;

// Get the pending code verifier
export const selectPendingCodeVerifier = (state: MoneriumStoreState) =>
    state.pendingCodeVerifier;

/**
 * Derived selectors for computed values
 */

// Check if connected (has access token)
export const selectIsConnected = (state: MoneriumStoreState) =>
    state.accessToken !== null;

// Check if token is expired
export const selectIsTokenExpired = (state: MoneriumStoreState) =>
    state.tokenExpiry !== null && Date.now() >= state.tokenExpiry;
