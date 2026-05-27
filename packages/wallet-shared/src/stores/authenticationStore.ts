/**
 * Zustand store for authentication management
 */

import type { Address } from "viem";
import { isAddressEqual } from "viem/utils";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { authenticatorStorage } from "../common/storage/authenticators";
import { recoveryHintStorage } from "../common/storage/recoveryHint";
import type { Session } from "../types/Session";
import type { AuthenticationStore } from "./types";

export type { PendingRegistration } from "./types";

/**
 * Authentication store managing last authenticator, webauthn actions, and SSO context
 * Persists lastAuthenticator, lastAuthenticationAt, lastWebAuthNAction, and pendingRegistration
 * ssoContext is in-memory only (not persisted)
 */
export const authenticationStore = createStore<AuthenticationStore>()(
    persist(
        (set) => ({
            lastAuthenticator: null,
            pendingRegistration: null,
            lastAuthenticationAt: null,
            lastWebAuthNAction: null,
            ssoContext: null,

            setLastAuthenticator: (lastAuthenticator) =>
                set({ lastAuthenticator }),
            setPendingRegistration: (pendingRegistration) =>
                set({ pendingRegistration }),
            setLastAuthenticationAt: (lastAuthenticationAt) =>
                set({ lastAuthenticationAt }),
            setLastWebAuthNAction: (lastWebAuthNAction) =>
                set({ lastWebAuthNAction }),
            setSsoContext: (ssoContext) => set({ ssoContext }),
        }),
        {
            name: "frak_authentication_store",
            partialize: (state) => ({
                lastAuthenticator: state.lastAuthenticator,
                pendingRegistration: state.pendingRegistration,
                lastAuthenticationAt: state.lastAuthenticationAt,
                lastWebAuthNAction: state.lastWebAuthNAction,
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

/**
 * Apply a freshly-minted wallet-merge session to every "current
 * authenticator" surface — the zustand `lastAuthenticator`, the
 * previous-authenticators IDB list, AND the platform-native recovery
 * hint (iCloud KV / Block Store).
 *
 * The merge re-binds an existing credential to a different wallet, so
 * `addLastAuthentication` on its own leaves the orphan loser-wallet row
 * in IDB (the list dedupes by NEW wallet key, not by `authenticatorId`).
 * We drop the loser row explicitly first, then reuse the standard write
 * path for the new (winner) binding.
 *
 * Mirrors the trio of writes `useLogin` performs on successful WebAuthn
 * authentication, so the wallet behaves identically post-merge as if the
 * user had freshly logged in with the credential against the winner
 * wallet.
 *
 * No-op when `session.address === previousAddress` (the requester was
 * the merge winner — their session didn't move).
 */
export async function applyMergeSession({
    previousAddress,
    session,
}: {
    previousAddress?: Address;
    session: Session;
}) {
    if (previousAddress && !isAddressEqual(previousAddress, session.address)) {
        await authenticatorStorage.remove(previousAddress);
    }

    await addLastAuthentication(session);

    await recoveryHintStorage.set({
        lastAuthenticatorId: session.authenticatorId,
        lastWallet: session.address,
        lastLoginAt: Date.now(),
    });
}
