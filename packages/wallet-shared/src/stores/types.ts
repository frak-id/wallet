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
 * Detached pairing session — written by the merge flow on both origin and
 * target sides instead of swapping the live `sessionStore.session`. Lets
 * the user keep their normal wallet active in the app while a pairing-
 * scoped credential signs cross-device merge ceremonies in the background.
 *
 * Scoped by `pairingId` so consumers can validate the slot still belongs
 * to the pairing they're driving (and clear stale state from a previous,
 * abandoned merge).
 */
export type DetachedPairingSession = {
    pairingId: string;
    session: Session;
    sdkSession: SdkSession | null;
};

/**
 * Tab-scoped store (sessionStorage backing) holding the active detached
 * pairing session. Single-slot — only one detached pairing can be in
 * flight per tab at a time, which matches the actual UX (one merge at a
 * time). Survives tab refreshes mid-flow; dies when the tab closes.
 */
export type DetachedPairingSessionStore = {
    detached: DetachedPairingSession | null;
    setDetachedSession: (session: DetachedPairingSession) => void;
    clearDetachedSession: () => void;
};

/**
 * Session Store Types
 */
export type SessionStore = {
    session: Session | null;
    sdkSession: SdkSession | null;
    demoPrivateKey: Hex | null;

    setSession: (session: Session | null) => void;
    setSdkSession: (sdkSession: SdkSession | null) => void;
    setDemoPrivateKey: (key: Hex | null) => void;
    clearSession: () => void;
};

/**
 * Authentication Store Types
 */

/** Last LOCAL webauthn authenticator — a credential present on THIS device. */
export type LastAuthentication = Session & { type: "webauthn" };

/**
 * Last REMOTE (paired) authenticator — the credential lives on another device,
 * reachable through its `pairingId`. Kept separately from `lastAuthentication`
 * (rather than as a union) so a pairing never clobbers the local credential the
 * local-login surfaces scope to, and vice-versa. No token is stored: a stale
 * pairing token is useless, and a resume reconnects via `pairingId`.
 */
export type RemoteLastAuthentication = {
    type: "distant-webauthn";
    address: Address;
    authenticatorId: string;
    pairingId: string;
};

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

type SsoContext = {
    merchantId?: string;
    redirectUrl?: string;
    directExit?: boolean;
    metadata?: AppSpecificSsoMetadata;
    id?: Hex;
};

type AppSpecificSsoMetadata = SsoMetadata & {
    name?: string;
    css?: string;
};

export type AuthenticationStore = {
    // State
    lastAuthenticator: LastAuthentication | null;
    lastRemoteAuthenticator: RemoteLastAuthentication | null;
    pendingRegistration: PendingRegistration | null;
    lastAuthenticationAt: number | null;
    ssoContext: SsoContext | null;

    // Actions
    setLastAuthenticator: (auth: LastAuthentication | null) => void;
    setLastRemoteAuthenticator: (auth: RemoteLastAuthentication | null) => void;
    setPendingRegistration: (pending: PendingRegistration | null) => void;
    setLastAuthenticationAt: (timestamp: number | null) => void;
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
