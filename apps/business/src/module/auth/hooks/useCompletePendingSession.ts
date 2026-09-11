import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { type BusinessAuthMethod, useAuthStore } from "@/stores/authStore";

/**
 * Clears `pending2fa` after `/auth/2fa/verify`. There is no whoami endpoint, so
 * the verified session is read back from `GET /auth/sessions`. `wallet` stays
 * as it was: password and Shopify SSO accounts are walletless until an explicit
 * `/auth/link/wallet`.
 */
export function useCompletePendingSession() {
    return useMutation({
        mutationKey: ["auth", "session", "complete"],
        mutationFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.auth.sessions.get();
            if (error) {
                throw new Error("Could not resolve session");
            }

            const current = data.find((session) => session.current);
            // No `current: true` row means the token no longer resolves
            // server-side; fail instead of desyncing the store.
            if (!current) {
                throw new Error("Could not resolve the verified session");
            }
            const state = useAuthStore.getState();
            if (!state.token) {
                throw new Error("No pending session");
            }

            state.setAuth({
                token: state.token,
                wallet: state.wallet,
                accountId: state.accountId,
                authMethod: current.authMethod as
                    | BusinessAuthMethod
                    | undefined,
                expiresAt: current.expiresAt,
                pending2fa: false,
            });

            return current;
        },
    });
}
