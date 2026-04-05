/**
 * Zustand store for authentication management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authenticatorStorage } from "../common/storage/authenticators";
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
            lastAuthenticationAt: null,
            lastWebAuthNAction: null,
            ssoContext: null,

            // Actions
            setLastAuthenticator: (lastAuthenticator) =>
                set({ lastAuthenticator }),
            setLastAuthenticationAt: (lastAuthenticationAt) =>
                set({ lastAuthenticationAt }),
            setLastWebAuthNAction: (lastWebAuthNAction) =>
                set({ lastWebAuthNAction }),
            setSsoContext: (ssoContext) => set({ ssoContext }),
            clearAuthentication: () =>
                set({
                    lastAuthenticator: null,
                    lastAuthenticationAt: null,
                    lastWebAuthNAction: null,
                    ssoContext: null,
                }),
        }),
        {
            name: "frak_authentication_store",
            partialize: (state) => ({
                lastAuthenticator: state.lastAuthenticator,
                lastAuthenticationAt: state.lastAuthenticationAt,
                lastWebAuthNAction: state.lastWebAuthNAction,
                // ssoContext is not persisted (in-memory only)
            }),
        }
    )
);

/**
 * Selector functions for computed values
 */

// Get the last authentication timestamp
export const selectLastAuthenticationAt = (state: AuthenticationStore) =>
    state.lastAuthenticationAt;

// Get the last WebAuthN action
export const selectLastWebAuthNAction = (state: AuthenticationStore) =>
    state.lastWebAuthNAction;

/**
 * Helper function to add last authentication
 */
export async function addLastAuthentication(authentication: Session) {
    authenticationStore.getState().setLastAuthenticationAt(Date.now());

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

    // Add it to the last authentications in IndexedDB
    await authenticatorStorage.put({
        wallet: authentication.address,
        authenticatorId: authentication.authenticatorId,
        transports: authentication.transports,
    });
}
