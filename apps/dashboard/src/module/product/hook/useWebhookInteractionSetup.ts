import { businessApi } from "@frak-labs/client/server";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";

/**
 * Hook to fetch the webhook interaction
 */
export function useWebhookInteractionSetup({ productId }: { productId: Hex }) {
    const { refetch } = useWebhookInteractionStatus({ productId });
    return useMutation({
        mutationKey: ["product", "webhook-interaction", "setup", productId],
        mutationFn: async ({
            productId,
            hookSignatureKey,
        }: {
            productId: Hex;
            hookSignatureKey: string;
        }) => {
            const { data, error } = await businessApi
                .product({ productId })
                .interactionsWebhook.setup.post({
                    source: "custom",
                    hookSignatureKey,
                });
            if (error) throw error;
            return data;
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
