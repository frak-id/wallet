import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useSafeResolvingContext } from "@/module/stores/hooks";

/**
 * Parameters for sending interactions
 */
type SendInteractionParams =
    | {
          type: "arrival";
          landingUrl?: string;
          utmSource?: string;
          utmMedium?: string;
          utmCampaign?: string;
          utmTerm?: string;
          utmContent?: string;
      }
    | { type: "sharing" }
    | {
          type: "custom";
          customType: string;
          data?: Record<string, unknown>;
          idempotencyKey?: string;
      };

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
        mutationFn: async (params: SendInteractionParams) => {
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
