import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";

/**
 * Hook to delete the webhook interaction
 */
export function useWebhookInteractionDelete({ productId }: { productId: Hex }) {
    const { refetch } = useWebhookInteractionStatus({ productId });
    return useMutation({
        mutationKey: ["product", "webhook-interaction", "delete", productId],
        mutationFn: async ({ productId }: { productId: Hex }) => {
            const { data, error } = await authenticatedBackendApi
                .product({ productId })
                .interactionsWebhook.delete.post();
            if (error) throw error;
            return data;
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
