import { backendApi } from "@frak-labs/shared/context/server";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";

/**
 * Hook to fetch the webhook interaction status
 */
export function useWebhookInteractionStatus({ productId }: { productId: Hex }) {
    return useQuery({
        queryKey: ["product", "webhook-interaction", "status", productId],
        queryFn: async () => {
            const { data: webhookStatus } = await backendApi.interactions
                .webhook({ productId })
                .status.get();

            return webhookStatus;
        },
    });
}
