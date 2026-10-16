import type { MoneriumAuthStartBodySchema } from "@backend-domain/monerium/schemas";
import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    authenticatedWalletApi,
    type MoneriumSiweFailure,
    openExternalUrl,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMoneriumSignMessage } from "@/module/monerium/hooks/useMoneriumSignMessage";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import type { MoneriumStatus } from "@/module/monerium/utils/deriveSetupScreen";
import {
    getMoneriumErrorCode,
    isUserCancelledError,
    unwrapMoneriumResponse,
} from "@/module/monerium/utils/moneriumErrors";

type MoneriumAuthMode = NonNullable<
    (typeof MoneriumAuthStartBodySchema)["static"]["authMode"]
>;

/** A declined or unavailable SIWE is expected: the portal takes over without an error report. */
function classifySiweFailure(error: unknown): MoneriumSiweFailure {
    if (isUserCancelledError(error)) return "cancelled";
    const code = getMoneriumErrorCode(error);
    return code === "MONERIUM_SIWE_REJECTED" ||
        code === "MONERIUM_SIWE_UNAVAILABLE"
        ? "rejected"
        : "error";
}

/**
 * Connects the wallet to Monerium: a silent Sign-In-With-Ethereum when the
 * backend says it is worth trying, the Monerium portal otherwise or when SIWE
 * is rejected or fails. A dismissed signature prompt stops and surfaces as an error.
 */
export function useMoneriumConnect() {
    const queryClient = useQueryClient();
    const signMessage = useMoneriumSignMessage();

    async function reconnectWithSiwe(): Promise<void> {
        const { state, message } = unwrapMoneriumResponse(
            await authenticatedWalletApi.monerium.auth.siwe.prepare.post()
        );
        const signature = await signMessage(message);
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
                    // The backend may have just turned `silentReconnect` off.
                    queryClient.invalidateQueries({
                        queryKey: moneriumKey.status,
                    });
                    const reason = classifySiweFailure(error);
                    trackEvent("monerium_siwe_outcome", { outcome: reason });
                    if (reason === "cancelled") throw error;
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
