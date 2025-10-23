/**
 * Zustand store for authentication management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dexieDb } from "../common/storage/dexie/dexieDb";
import type { Session } from "../types/Session";
import type { AuthenticationStore } from "./types";

/**
 * Authentication store managing last authenticator, webauthn actions, and SSO context
 * lastAuthenticator and lastWebAuthNAction use persist middleware
 * ssoContext is in-memory only (not persisted)
 */
export const authenticationStore = create<AuthenticationStore>()(
    persist(
        (set) => ({
            // Initial state
            lastAuthenticator: null,
            lastWebAuthNAction: null,
            ssoContext: null,

            // Actions
            setLastAuthenticator: (lastAuthenticator) =>
                set({ lastAuthenticator }),
            setLastWebAuthNAction: (lastWebAuthNAction) =>
                set({ lastWebAuthNAction }),
            setSsoContext: (ssoContext) => set({ ssoContext }),
            clearAuthentication: () =>
                set({
                    lastAuthenticator: null,
                    lastWebAuthNAction: null,
                    ssoContext: null,
                }),
        }),
        {
            name: "frak_authentication_store",
            partialize: (state) => ({
                lastAuthenticator: state.lastAuthenticator,
                lastWebAuthNAction: state.lastWebAuthNAction,
                // ssoContext is not persisted (in-memory only)
            }),
        }
    )
);

/**
 * Selector functions for computed values
 */

// Get the last authenticator
export const selectLastAuthenticator = (state: AuthenticationStore) =>
    state.lastAuthenticator;

// Get the last WebAuthN action
export const selectLastWebAuthNAction = (state: AuthenticationStore) =>
    state.lastWebAuthNAction;

// Get the SSO context
export const selectSsoContext = (state: AuthenticationStore) =>
    state.ssoContext;

// Get the current SSO metadata (derived selector)
export const selectCurrentSsoMetadata = (state: AuthenticationStore) =>
    state.ssoContext?.metadata;

/**
 * Helper function to add last authentication
 */
export async function addLastAuthentication(authentication: Session) {
    // Ensure that's a webauthn one
    if (
        authentication.type !== "webauthn" &&
        authentication.type !== undefined
    ) {
        return;
    }

    // Only proceed if we have authenticatorId (webauthn wallet)
    if (
        !authentication.authenticatorId ||
        typeof authentication.authenticatorId !== "string"
    ) {
        return;
    }

    // Create a properly typed webauthn session
    const webauthnSession = {
        ...authentication,
        type: "webauthn" as const,
    };

    // Define it as last authentication
    authenticationStore.getState().setLastAuthenticator(webauthnSession);

    // Add it to the last authentications in Dexie
    await dexieDb.previousAuthenticator.put({
        wallet: authentication.address,
        authenticatorId: authentication.authenticatorId,
        transports: authentication.transports,
    });
}
