/**
 * TypeScript types for Zustand stores in wallet-shared
 */

import type { SsoMetadata } from "@frak-labs/core-sdk";
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import type { Address, Hex } from "viem";
import type { PendingInteraction } from "../types/Interaction";
import type { InteractionSession, SdkSession, Session } from "../types/Session";
import type { User } from "../types/User";

/**
 * Session Store Types
 */
export type SessionStore = {
    // State
    session: Session | null;
    sdkSession: SdkSession | null;
    demoPrivateKey: Hex | null;

    // Actions
    setSession: (session: Session | null) => void;
    setSdkSession: (sdkSession: SdkSession | null) => void;
    setDemoPrivateKey: (key: Hex | null) => void;
    clearSession: () => void;
};

/**
 * User Store Types
 */
export type UserStore = {
    // State
    user: User | null;
    userSetupLater: boolean | null;

    // Actions
    setUser: (user: User | null) => void;
    setUserSetupLater: (setupLater: boolean | null) => void;
    clearUser: () => void;
};

/**
 * Authentication Store Types
 */
export type LastWebAuthNAction = {
    wallet: Address;
    signature: AuthenticationResponseJSON;
    msg: string;
};

export type LastAuthentication = Session & { type: "webauthn" };

export type SsoContext = {
    productId?: string;
    redirectUrl?: string;
    directExit?: boolean;
    metadata?: AppSpecificSsoMetadata;
    id?: Hex;
};

export type AppSpecificSsoMetadata = SsoMetadata & {
    name: string;
    css?: string;
};

export type AuthenticationStore = {
    // State
    lastAuthenticator: LastAuthentication | null;
    lastWebAuthNAction: LastWebAuthNAction | null;
    ssoContext: SsoContext | null;

    // Actions
    setLastAuthenticator: (auth: LastAuthentication | null) => void;
    setLastWebAuthNAction: (action: LastWebAuthNAction | null) => void;
    setSsoContext: (context: SsoContext | null) => void;
    clearAuthentication: () => void;
};

/**
 * Wallet Store Types
 */
export type PendingInteractionsStorage = {
    interactions: PendingInteraction[];
};

export type WalletStore = {
    // State
    interactionSession: InteractionSession | null;
    pendingInteractions: PendingInteractionsStorage;

    // Actions
    setInteractionSession: (session: InteractionSession | null) => void;
    addPendingInteraction: (interaction: PendingInteraction) => void;
    addPendingInteractions: (interactions: PendingInteraction[]) => void;
    cleanPendingInteractions: () => void;
    clearWallet: () => void;
};
