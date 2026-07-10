import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useAuthStore } from "@/stores/authStore";

/**
 * After `/auth/2fa/verify` succeeds for a pending (password or Shopify SSO)
 * login, the session is fully verified server-side but the store still
 * carries `pending2fa: true`. There is no dedicated "whoami" endpoint
 * (§4.6 lists none), so this reads `GET /auth/sessions`, finds the caller's
 * own session (`current: true`) for its `authMethod`, and clears the pending
 * flag. `wallet`/`accountId` stay whatever they already were — password and
 * Shopify SSO accounts are walletless until an explicit `/auth/link/wallet`
 * (§4.9), so leaving `wallet: null` here is correct, not a placeholder.
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
            const state = useAuthStore.getState();
            if (!state.token) {
                throw new Error("No pending session");
            }

            state.setAuth({
                token: state.token,
                wallet: state.wallet,
                accountId: state.accountId,
                authMethod: current?.authMethod as
                    | "siwe"
                    | "password"
                    | "shopify"
                    | undefined,
                expiresAt: current?.expiresAt ?? state.expiresAt ?? Date.now(),
                pending2fa: false,
            });

            return current;
        },
    });
}
