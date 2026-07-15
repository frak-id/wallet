/**
 * Zustand store for authentication management
 */

import { areAddressesEqual } from "@frak-labs/core-sdk";
import type { Address } from "viem";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { authenticatorStorage } from "../common/storage/authenticators";
import { recoveryHintStorage } from "../common/storage/recoveryHint";
import type { Session } from "../types/Session";
import type { AuthenticationStore, RemoteLastAuthentication } from "./types";

export type { PendingRegistration } from "./types";

/**
 * Authentication store managing last authenticator and SSO context
 * Persists lastAuthenticator, lastAuthenticationAt, and pendingRegistration
 * ssoContext is in-memory only (not persisted)
 */
export const authenticationStore = createStore<AuthenticationStore>()(
    persist(
        (set) => ({
            lastAuthenticator: null,
            lastRemoteAuthenticator: null,
            pendingRegistration: null,
            lastAuthenticationAt: null,
            ssoContext: null,

            setLastAuthenticator: (lastAuthenticator) =>
                set({ lastAuthenticator }),
            setLastRemoteAuthenticator: (lastRemoteAuthenticator) =>
                set({ lastRemoteAuthenticator }),
            setPendingRegistration: (pendingRegistration) =>
                set({ pendingRegistration }),
            setLastAuthenticationAt: (lastAuthenticationAt) =>
                set({ lastAuthenticationAt }),
            setSsoContext: (ssoContext) => set({ ssoContext }),
        }),
        {
            name: "frak_authentication_store",
            partialize: (state) => ({
                lastAuthenticator: state.lastAuthenticator,
                lastRemoteAuthenticator: state.lastRemoteAuthenticator,
                pendingRegistration: state.pendingRegistration,
                lastAuthenticationAt: state.lastAuthenticationAt,
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

// Get the last LOCAL webauthn authenticator (durable across session clears)
export const selectLastAuthenticator = (state: AuthenticationStore) =>
    state.lastAuthenticator;

// Get the last REMOTE (paired) authenticator
export const selectLastRemoteAuthenticator = (state: AuthenticationStore) =>
    state.lastRemoteAuthenticator;

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
 * Record a freshly-paired (distant-webauthn) authenticator.
 *
 * `addLastAuthentication` deliberately ignores non-local sessions (their
 * credential isn't on this device), which left the auth store blind to
 * pairings — neither `lastAuthenticationAt` nor any authenticator record was
 * updated when a phone paired. This persists the remote authenticator so the
 * store has a durable record of the paired credential ({ pairingId,
 * authenticatorId }) instead of it living only in the volatile session store.
 */
export function recordDistantAuthenticator(
    authenticator: RemoteLastAuthentication
) {
    authenticationStore.getState().setLastAuthenticationAt(Date.now());
    authenticationStore.getState().setLastRemoteAuthenticator(authenticator);
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
    if (
        previousAddress &&
        !areAddressesEqual(previousAddress, session.address)
    ) {
        await authenticatorStorage.remove(previousAddress);
    }

    await addLastAuthentication(session);

    await recoveryHintStorage.set({
        lastAuthenticatorId: session.authenticatorId,
        lastWallet: session.address,
        lastLoginAt: Date.now(),
    });
}

/**
 * Clear every "current authenticator" surface — the zustand
 * `lastAuthenticator`, the platform-native recovery hint (iCloud KV / Block
 * Store), AND (when a wallet is given) its row in the previous-authenticators
 * IDB list. Symmetric counterpart to `addLastAuthentication` /
 * `applyMergeSession`, used to self-heal a stale "last authenticator" hint
 * (e.g. after a silent quick-login fails with `no-credential`) so all three
 * surfaces agree there is no local authenticator.
 *
 * The zustand clear runs synchronously, before any `await` — callers rely on
 * it flipping UI state (e.g. hiding the "use my account" button) immediately,
 * without waiting on the native/IDB clears to resolve. The two async clears
 * are independent and run concurrently: a stalled cloud-KV invoke must not
 * delay the IDB eviction (the register gate's primary signal). Both storages
 * swallow their own errors internally, so this helper never rejects in
 * practice.
 *
 * `wallet` is optional: pass the stale hint's wallet to also evict its IDB
 * row (targeted removal, preserving any other valid entries). Omit it to
 * clear only the zustand + cloud hint surfaces.
 */
export async function clearLastAuthenticator(wallet?: Address) {
    authenticationStore.getState().setLastAuthenticator(null);

    await Promise.all([
        recoveryHintStorage.clear(),
        wallet ? authenticatorStorage.remove(wallet) : undefined,
    ]);
}
