/**
 * Zustand store for session management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionStore } from "./types";

/**
 * Session store managing user session, SDK session, and demo private key
 * Uses persist middleware to sync with localStorage
 */
export const sessionStore = create<SessionStore>()(
    persist(
        (set) => ({
            // Initial state
            session: null,
            sdkSession: null,
            demoPrivateKey: null,

            // Actions
            setSession: (session) => set({ session }),
            setSdkSession: (sdkSession) => set({ sdkSession }),
            setDemoPrivateKey: (demoPrivateKey) => set({ demoPrivateKey }),
            clearSession: () =>
                set({
                    session: null,
                    sdkSession: null,
                    demoPrivateKey: null,
                }),
        }),
        {
            name: "frak_session_store",
            partialize: (state) => ({
                session: state.session,
                sdkSession: state.sdkSession,
                demoPrivateKey: state.demoPrivateKey,
            }),
        }
    )
);

/**
 * Selector functions for computed values
 */

// Get the current session
export const selectSession = (state: SessionStore) => state.session;

// Get the SDK session
export const selectSdkSession = (state: SessionStore) => state.sdkSession;

// Get the demo private key
export const selectDemoPrivateKey = (state: SessionStore) =>
    state.demoPrivateKey;

// Get webauthn session (derived selector)
export const selectWebauthnSession = (state: SessionStore) => {
    const session = state.session;
    if (!session || (session.type !== undefined && session.type !== "webauthn"))
        return null;
    return session;
};

// Get ECDSA session (derived selector)
export const selectEcdsaSession = (state: SessionStore) => {
    const session = state.session;
    if (!session || session.type !== "ecdsa") return null;
    return session;
};

// Get distant webauthn session (derived selector)
export const selectDistantWebauthnSession = (state: SessionStore) => {
    const session = state.session;
    if (!session || session.type !== "distant-webauthn") return null;
    return session;
};
