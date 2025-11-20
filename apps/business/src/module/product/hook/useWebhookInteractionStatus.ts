import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";

/**
 * Hook to fetch the webhook interaction status
 */
export function useWebhookInteractionStatus({ productId }: { productId: Hex }) {
    return useQuery({
        queryKey: ["product", "webhook-interaction", "status", productId],
        queryFn: async () => {
            const { data: webhookStatus } = await authenticatedBackendApi
                .product({ productId })
                .interactionsWebhook.status.get();

            return webhookStatus;
        },
    });
}
