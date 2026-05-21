/**
 * TypeScript types for Zustand stores in wallet-shared
 */

import type { SsoMetadata } from "@frak-labs/core-sdk";
import type { Signature } from "ox";
import type { SignMetadata } from "ox/WebAuthnP256";
import type { Address, Hex } from "viem";
import type { SdkSession, Session } from "../types/Session";

/**
 * WebAuthn authentication response structure
 */
export type AuthenticationResponseJSON = {
    id: string;
    response: {
        metadata: SignMetadata;
        signature: Signature.Signature<false>;
    };
};

/**
 * A snapshot of `{ session, sdkSession }` parked on the session store while
 * the wallet temporarily logs in as a different credential — currently only
 * the wallet-merge flow, which has to switch to the winner credential to
 * sign the on-chain `addPassKey` userOp and then restore the original
 * session afterwards. Persisted alongside the live session so a tab refresh
 * mid-flow does not lose the restore target.
 */
export type PreviousSessionSnapshot = {
    session: Session;
    sdkSession: SdkSession | null;
};

/**
 * Session Store Types
 */
export type SessionStore = {
    // State
    session: Session | null;
    sdkSession: SdkSession | null;
    previousSession: PreviousSessionSnapshot | null;
    demoPrivateKey: Hex | null;

    // Actions
    setSession: (session: Session | null) => void;
    setSdkSession: (sdkSession: SdkSession | null) => void;
    setDemoPrivateKey: (key: Hex | null) => void;
    clearSession: () => void;
    /**
     * Park a previously-captured snapshot of `{ session, sdkSession }` into
     * the `previousSession` slot. Caller must take the snapshot **before**
     * swapping the live session (e.g. before calling `useLogin`) and invoke
     * this once the swap has completed. The live session slots are left
     * untouched — there is no null window for observers. Refuses to
     * overwrite an existing snapshot (returns `false`) so a flow that
     * fails to pop cannot quietly lose the original target.
     */
    parkSession: (snapshot: PreviousSessionSnapshot) => boolean;
    /**
     * Restore the snapshot saved by `parkSession` into the live session
     * slots. Clears the snapshot. Returns `false` when there is nothing to
     * restore.
     */
    popSession: () => boolean;
};

/**
 * Authentication Store Types
 */
export type LastWebAuthNAction = {
    wallet: Address;
    signature: AuthenticationResponseJSON;
    challenge: Hex;
};

export type LastAuthentication = Session & { type: "webauthn" };

/**
 * A WebAuthn registration that succeeded on the device but is not yet
 * confirmed by the backend. Lets the wallet retry the backend submit
 * without re-prompting biometrics.
 */
export type PendingRegistration = {
    credentialId: string;
    publicKey: { x: Hex; y: Hex; prefix: number };
    rawEncoded: string;
    email?: string;
    merchantId?: string;
    userAgent: string;
    createdAt: number;
};

export type SsoContext = {
    merchantId?: string;
    redirectUrl?: string;
    directExit?: boolean;
    metadata?: AppSpecificSsoMetadata;
    id?: Hex;
};

export type AppSpecificSsoMetadata = SsoMetadata & {
    name?: string;
    css?: string;
};

export type AuthenticationStore = {
    // State
    lastAuthenticator: LastAuthentication | null;
    pendingRegistration: PendingRegistration | null;
    lastAuthenticationAt: number | null;
    lastWebAuthNAction: LastWebAuthNAction | null;
    ssoContext: SsoContext | null;

    // Actions
    setLastAuthenticator: (auth: LastAuthentication | null) => void;
    setPendingRegistration: (pending: PendingRegistration | null) => void;
    setLastAuthenticationAt: (timestamp: number | null) => void;
    setLastWebAuthNAction: (action: LastWebAuthNAction | null) => void;
    setSsoContext: (context: SsoContext | null) => void;
};
/**
 * Client ID Store Types
 *
 * TODO: Evolve to Record<merchantId, clientId> for per-merchant tracking
 */
export type ClientIdStore = {
    // State
    clientId: string | null;

    // Actions
    setClientId: (clientId: string | null) => void;
    clearClientId: () => void;
};
