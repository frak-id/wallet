import { recordError } from "@frak-labs/wallet-shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MONERIUM_STORE_NAME = "frak_monerium_store";

/**
 * Window for the OAuth redirect to return. Wide enough for bank 2FA in an
 * external browser on Tauri; a pair older than this is treated as abandoned.
 */
export const PENDING_AUTH_TTL_MS = 30 * 60 * 1000;

type MoneriumStoreState = {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null;
    /**
     * PKCE verifier and CSRF state nonce, generated together at the start of
     * the OAuth redirect and consumed when the callback returns. Stored as
     * a pair so we can never use one without validating the other.
     */
    pendingCodeVerifier: string | null;
    pendingState: string | null;
    /** Set together with the pending pair; drives the TTL on rehydration. */
    pendingAuthCreatedAt: number | null;
    hasSeenSetupSuccess: boolean;

    setTokens: (access: string, refresh: string, expiresIn: number) => void;
    setPendingAuth: (verifier: string, state: string) => void;
    clearPendingAuth: () => void;
    markSetupSuccessSeen: () => void;
    disconnect: () => void;
};

type PersistedMoneriumState = Pick<
    MoneriumStoreState,
    | "accessToken"
    | "refreshToken"
    | "tokenExpiry"
    | "pendingCodeVerifier"
    | "pendingState"
    | "pendingAuthCreatedAt"
    | "hasSeenSetupSuccess"
>;

const initialPersistedState: PersistedMoneriumState = {
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    pendingCodeVerifier: null,
    pendingState: null,
    pendingAuthCreatedAt: null,
    hasSeenSetupSuccess: false,
};

/**
 * Picks the persisted slice out of whatever localStorage held. Runs on
 * every hydration, so a payload anyone can write never reaches the store:
 * a wrong type on any field yields the disconnected slice, and unknown
 * keys are dropped rather than spread over the actions.
 */
function pickPersistedState(value: unknown): PersistedMoneriumState {
    if (typeof value !== "object" || value === null) {
        return initialPersistedState;
    }
    const state = value as Record<string, unknown>;
    // `undefined` is accepted here alone: a v0 payload predates the field.
    const pendingAuthCreatedAt = state.pendingAuthCreatedAt ?? null;
    const isValid =
        (state.accessToken === null || typeof state.accessToken === "string") &&
        (state.refreshToken === null ||
            typeof state.refreshToken === "string") &&
        (state.tokenExpiry === null || typeof state.tokenExpiry === "number") &&
        (state.pendingCodeVerifier === null ||
            typeof state.pendingCodeVerifier === "string") &&
        (state.pendingState === null ||
            typeof state.pendingState === "string") &&
        (pendingAuthCreatedAt === null ||
            typeof pendingAuthCreatedAt === "number") &&
        typeof state.hasSeenSetupSuccess === "boolean";
    if (!isValid) return initialPersistedState;
    return {
        accessToken: state.accessToken as string | null,
        refreshToken: state.refreshToken as string | null,
        tokenExpiry: state.tokenExpiry as number | null,
        pendingCodeVerifier: state.pendingCodeVerifier as string | null,
        pendingState: state.pendingState as string | null,
        pendingAuthCreatedAt: pendingAuthCreatedAt as number | null,
        hasSeenSetupSuccess: state.hasSeenSetupSuccess as boolean,
    };
}

/** A stamp in the future is a clock that moved; treat it as expired too. */
export function isPendingAuthExpired(
    createdAt: number | null,
    now = Date.now()
): boolean {
    if (createdAt === null) return true;
    const age = now - createdAt;
    return age < 0 || age > PENDING_AUTH_TTL_MS;
}

export const moneriumStore = create<MoneriumStoreState>()(
    persist(
        (set) => ({
            ...initialPersistedState,

            setTokens: (access, refresh, expiresIn) =>
                set({
                    accessToken: access,
                    refreshToken: refresh,
                    tokenExpiry: Date.now() + expiresIn * 1000,
                }),
            setPendingAuth: (verifier, state) =>
                set({
                    pendingCodeVerifier: verifier,
                    pendingState: state,
                    pendingAuthCreatedAt: Date.now(),
                }),
            clearPendingAuth: () =>
                set({
                    pendingCodeVerifier: null,
                    pendingState: null,
                    pendingAuthCreatedAt: null,
                }),
            markSetupSuccessSeen: () => set({ hasSeenSetupSuccess: true }),
            disconnect: () => set(initialPersistedState),
        }),
        {
            name: MONERIUM_STORE_NAME,
            version: 1,
            // Reuses the hydration picker: one list of persisted fields,
            // so what is written can never drift from what is accepted.
            partialize: (state: MoneriumStoreState) =>
                pickPersistedState(state),
            // Without `migrate` a v0 payload is discarded, logging out every
            // connected user on upgrade. `migrate` only runs when the stored
            // version differs, so validation lives in `merge`, which runs on
            // every hydration; v0 -> v1 is the `pendingAuthCreatedAt` default.
            migrate: (persistedState) => persistedState,
            merge: (persistedState, currentState) => ({
                ...currentState,
                ...pickPersistedState(persistedState),
            }),
            /**
             * Drops a PKCE pair older than the TTL or without a timestamp;
             * tokens are left alone so a connected user stays connected.
             * A read failure leaves the disconnected slice: reconnecting
             * through the normal flow is the only recovery there is.
             */
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    recordError(error, { source: "monerium_store_rehydrate" });
                    return;
                }
                if (!state || state.pendingCodeVerifier === null) return;
                if (isPendingAuthExpired(state.pendingAuthCreatedAt)) {
                    state.clearPendingAuth();
                }
            },
        }
    )
);

export const isMoneriumConnected = (state: MoneriumStoreState) =>
    state.accessToken !== null;
