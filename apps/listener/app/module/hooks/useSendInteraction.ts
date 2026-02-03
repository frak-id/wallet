import type { SendInteractionParamsType } from "@frak-labs/core-sdk";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useSafeResolvingContext } from "@/module/stores/hooks";

/**
 * Unified mutation hook for sending interactions to the backend.
 * Used by both RPC handler and internal sharing tracking.
 *
 * Note: Fire-and-forget - errors are caught and logged, not thrown.
 */
export function useSendInteraction() {
    const { merchantId, walletReferrer } = useSafeResolvingContext();

    return useMutation({
        mutationKey: ["send-interaction", merchantId],
        mutationFn: async (params: SendInteractionParamsType) => {
            if (!merchantId) return;

            try {
                await authenticatedBackendApi.user.track.interaction.post({
                    ...params,
                    merchantId,
                    // Add referrerWallet for arrival type
                    ...(params.type === "arrival" && walletReferrer
                        ? { referrerWallet: walletReferrer }
                        : {}),
                });
            } catch (error) {
                // Fire-and-forget: log but don't throw
                console.warn(
                    "[Listener] Failed to send interaction:",
                    params.type,
                    error
                );
            }
        },
    });
}
