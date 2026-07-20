import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    AuthError,
    authErrorMessage,
    extractAuthErrorCode,
    extractAuthErrorMessage,
} from "@/module/auth/utils/authError";
import { useAuthStore } from "@/stores/authStore";

/** Synthetic code for a wallet signature the user dismissed in the modal. */
const SIGNATURE_CANCELLED_CODE = "WALLET_SIGNATURE_CANCELLED";

/**
 * Flow-specific code → key overrides for `useLinkWallet` errors: the step-up
 * 401 (`STEP_UP_REQUIRED`, wording tells the user to re-verify then retry),
 * the already-linked wallet conflict (`WALLET_TAKEN`) and the dismissed
 * wallet signature (`WALLET_SIGNATURE_CANCELLED`).
 */
const LINK_WALLET_CODE_KEYS = {
    STEP_UP_REQUIRED: "errors.linkWallet.stepUpRequired",
    WALLET_TAKEN: "errors.linkWallet.walletTaken",
    [SIGNATURE_CANCELLED_CODE]: "errors.linkWallet.signatureCancelled",
} as const;

/**
 * Map a `useLinkWallet` error to a translated, user-facing message. Anything
 * outside `LINK_WALLET_CODE_KEYS` falls back to the error's own message.
 */
export function linkWalletErrorMessage(
    error: unknown,
    t: TFunction
): string | null {
    if (!error) return null;
    return authErrorMessage(
        error,
        t,
        extractAuthErrorMessage(error, ""),
        LINK_WALLET_CODE_KEYS
    );
}

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
            let result: Awaited<ReturnType<typeof siweAuthenticate>>;
            try {
                result = await siweAuthenticate({
                    siwe: {
                        statement:
                            "Link this wallet to your Frak business account",
                    },
                });
            } catch (error) {
                // The user dismissed the wallet signature modal — tag it so
                // the UI shows a translated message instead of the raw RPC
                // string.
                if (
                    error instanceof FrakRpcError &&
                    (error.code === RpcErrorCodes.clientAborted ||
                        error.code === RpcErrorCodes.userRejected)
                ) {
                    throw new AuthError(
                        error.message,
                        SIGNATURE_CANCELLED_CODE
                    );
                }
                throw error;
            }

            const { data, error } =
                await authenticatedBackendApi.auth.link.wallet.post({
                    message: result.message,
                    signature: result.signature,
                });
            if (error) {
                // Preserve the backend `code` (e.g. STEP_UP_REQUIRED) so the
                // linking UI can show a translated message.
                throw new AuthError(
                    extractAuthErrorMessage(error, "Could not link wallet"),
                    extractAuthErrorCode(error)
                );
            }

            useAuthStore.getState().setWallet(data.wallet);
            await queryClient.invalidateQueries({ queryKey: ["merchant"] });
            // Refresh the linked-credentials view (now has a wallet).
            await queryClient.invalidateQueries({
                queryKey: ["auth", "account"],
            });

            return data;
        },
    });
}
