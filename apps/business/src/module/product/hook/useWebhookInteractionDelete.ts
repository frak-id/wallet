import { businessApi } from "@frak-labs/client/server";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";

/**
 * Hook to delete the webhook interaction
 */
export function useWebhookInteractionDelete({ productId }: { productId: Hex }) {
    const { refetch } = useWebhookInteractionStatus({ productId });
    return useMutation({
        mutationKey: ["product", "webhook-interaction", "delete", productId],
        mutationFn: async ({ productId }: { productId: Hex }) => {
            const { data, error } = await businessApi
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
