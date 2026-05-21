/**
 * Zustand store for session management
 */

import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { SessionStore } from "./types";

/**
 * Session store managing user session, SDK session, and demo private key
 * Uses persist middleware to sync with localStorage
 */
export const sessionStore = createStore<SessionStore>()(
    persist(
        (set, get) => ({
            // Initial state
            session: null,
            sdkSession: null,
            previousSession: null,
            demoPrivateKey: null,

            // Actions
            setSession: (session) => set({ session }),
            setSdkSession: (sdkSession) => set({ sdkSession }),
            setDemoPrivateKey: (demoPrivateKey) => set({ demoPrivateKey }),
            clearSession: () =>
                set({
                    session: null,
                    sdkSession: null,
                    previousSession: null,
                    demoPrivateKey: null,
                }),
            parkSession: (snapshot) => {
                const { previousSession } = get();
                if (previousSession) return false;
                set({ previousSession: snapshot });
                return true;
            },
            popSession: () => {
                const { previousSession } = get();
                if (!previousSession) return false;
                set({
                    session: previousSession.session,
                    sdkSession: previousSession.sdkSession,
                    previousSession: null,
                });
                return true;
            },
            discardPreviousSession: () => {
                const { previousSession } = get();
                if (!previousSession) return false;
                set({ previousSession: null });
                return true;
            },
        }),
        {
            name: "frak_session_store",
            partialize: (state) => ({
                session: state.session,
                sdkSession: state.sdkSession,
                previousSession: state.previousSession,
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

// Get the parked previous session (set by `parkSession`, restored by `popSession`)
export const selectPreviousSession = (state: SessionStore) =>
    state.previousSession;

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
