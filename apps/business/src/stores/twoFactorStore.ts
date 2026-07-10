import { create } from "zustand";

export type TwoFactorMethod = "email" | "totp" | "siwe";

type PendingRequest = {
    methods: TwoFactorMethod[];
    resolve: (verified: boolean) => void;
};

type TwoFactorState = {
    request: PendingRequest | null;
    /**
     * Methods advertised by `POST /auth/login/password` (§4.6 — the 200
     * response already lists them) for the account currently completing a
     * pending login. Consumed once by `/login/2fa` and cleared; the
     * Shopify SSO redirect carries no such list (the callback only hands
     * back a token), so that path falls back to offering every channel.
     */
    pendingLoginMethods: TwoFactorMethod[] | null;
    setPendingLoginMethods: (methods: TwoFactorMethod[]) => void;
    consumePendingLoginMethods: () => TwoFactorMethod[] | null;
    /**
     * Opens the step-up modal and resolves once the user completes (or
     * cancels) a 2FA challenge. Used both by `stepUpAwareFetch` (§4.5,
     * transparent retry-on-401) and the `/login/2fa` route (pending-login
     * completion) — same backend semantics, same UI.
     */
    requestVerification: (methods: TwoFactorMethod[]) => Promise<boolean>;
    /** Called by the modal once `/auth/2fa/verify` succeeds. */
    resolveVerification: () => void;
    /** Called on modal dismissal without completing verification. */
    cancelVerification: () => void;
};

export const useTwoFactorStore = create<TwoFactorState>()((set, get) => ({
    request: null,
    pendingLoginMethods: null,

    setPendingLoginMethods: (methods) => {
        set({ pendingLoginMethods: methods });
    },

    consumePendingLoginMethods: () => {
        const methods = get().pendingLoginMethods;
        set({ pendingLoginMethods: null });
        return methods;
    },

    requestVerification: (methods) => {
        // A step-up request already in flight (e.g. two mutations racing
        // into a 401 at once) reuses the same pending promise rather than
        // opening a second modal.
        const existing = get().request;
        if (existing) {
            return new Promise((resolve) => {
                const previousResolve = existing.resolve;
                set({
                    request: {
                        methods: existing.methods,
                        resolve: (verified) => {
                            previousResolve(verified);
                            resolve(verified);
                        },
                    },
                });
            });
        }

        return new Promise((resolve) => {
            set({ request: { methods, resolve } });
        });
    },

    resolveVerification: () => {
        get().request?.resolve(true);
        set({ request: null });
    },

    cancelVerification: () => {
        get().request?.resolve(false);
        set({ request: null });
    },
}));
