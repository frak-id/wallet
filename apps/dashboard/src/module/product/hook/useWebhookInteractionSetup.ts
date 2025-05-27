import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";
import { backendApi } from "@frak-labs/shared/context/server";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";

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
        }: { productId: Hex; hookSignatureKey: string }) => {
            const { data, error } = await backendApi.interactions
                .webhook({ productId })
                .setup.post({ source: "custom", hookSignatureKey });
            if (error) throw error;
            return data;
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
