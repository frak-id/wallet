import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useAuthStore } from "@/stores/authStore";
import { extractAuthErrorMessage } from "./useTwoFactorChallenge";

/**
 * `POST /auth/link/wallet` (§4.9): SIWE proof attaches a wallet credential
 * to the current (walletless) account, unlocking the onchain bank actions.
 * Step-up-guarded server-side — a stale session transparently triggers the
 * 2FA modal via `stepUpAwareFetch` before this mutation's request lands.
 */
export function useLinkWallet() {
    const queryClient = useQueryClient();
    const { mutateAsync: siweAuthenticate } = useSiweAuthenticate();

    return useMutation({
        mutationKey: ["auth", "link", "wallet"],
        mutationFn: async () => {
            const result = await siweAuthenticate({
                siwe: {
                    statement: "Link this wallet to your Frak business account",
                },
            });

            const { data, error } =
                await authenticatedBackendApi.auth.link.wallet.post({
                    message: result.message,
                    signature: result.signature,
                });
            if (error) {
                throw new Error(
                    extractAuthErrorMessage(error, "Could not link wallet")
                );
            }

            useAuthStore.getState().setWallet(data.wallet);
            await queryClient.invalidateQueries({ queryKey: ["merchant"] });

            return data;
        },
    });
}
