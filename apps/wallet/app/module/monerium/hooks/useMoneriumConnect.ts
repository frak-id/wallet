import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    authenticatedWalletApi,
    type MoneriumSiweFailure,
    openExternalUrl,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import type { MoneriumStatus } from "@/module/monerium/utils/deriveSetupScreen";
import {
    getMoneriumErrorCode,
    isUserCancelledError,
    unwrapMoneriumResponse,
} from "@/module/monerium/utils/moneriumErrors";

export type MoneriumAuthMode = "login" | "signup";

function classifySiweFailure(error: unknown): MoneriumSiweFailure {
    if (isUserCancelledError(error)) return "cancelled";
    return getMoneriumErrorCode(error) === "MONERIUM_SIWE_REJECTED"
        ? "rejected"
        : "error";
}

/**
 * Connects the wallet to Monerium: a silent Sign-In-With-Ethereum when the
 * backend says it is worth trying, the Monerium portal otherwise or on any
 * SIWE failure, including a dismissed signature prompt.
 */
export function useMoneriumConnect() {
    const queryClient = useQueryClient();
    const { mutateAsync: signMessageAsync } = useSignMessage();

    async function reconnectWithSiwe(): Promise<void> {
        const { state, message } = unwrapMoneriumResponse(
            await authenticatedWalletApi.monerium.auth.siwe.prepare.post()
        );
        const signature = await signMessageAsync({ message });
        const status = unwrapMoneriumResponse(
            await authenticatedWalletApi.monerium.auth.siwe.post({
                state,
                signature,
            })
        );
        queryClient.setQueryData(moneriumKey.status, status);
    }

    async function openPortal(authMode?: MoneriumAuthMode): Promise<void> {
        const { url } = unwrapMoneriumResponse(
            await authenticatedWalletApi.monerium.auth.start.post({ authMode })
        );
        if (IS_TAURI) {
            await openExternalUrl(url);
            return;
        }
        window.location.assign(url);
    }

    const mutation = useMutation({
        mutationFn: async (
            options: { authMode?: MoneriumAuthMode } = {}
        ): Promise<void> => {
            const status = queryClient.getQueryData<MoneriumStatus>(
                moneriumKey.status
            );
            const trySiwe = status?.silentReconnect === true;
            trackEvent("monerium_auth_started", {
                is_tauri: IS_TAURI,
                method: trySiwe ? "siwe" : "portal",
            });

            if (trySiwe) {
                trackEvent("monerium_siwe_attempt");
                try {
                    await reconnectWithSiwe();
                    trackEvent("monerium_siwe_outcome", { outcome: "success" });
                    return;
                } catch (error) {
                    const reason = classifySiweFailure(error);
                    trackEvent("monerium_siwe_outcome", { outcome: reason });
                    trackEvent("monerium_siwe_fallback", { reason });
                    if (reason === "error") {
                        recordError(error, { source: "monerium_api" });
                    }
                }
            }

            await openPortal(options.authMode);
        },
    });

    return {
        connect: mutation.mutate,
        connectAsync: mutation.mutateAsync,
        isConnecting: mutation.isPending,
        error: mutation.error,
    };
}
