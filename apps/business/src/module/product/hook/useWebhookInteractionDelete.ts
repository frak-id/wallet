import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";

/**
 * Hook to delete the webhook interaction
 */
export function useWebhookInteractionDelete({
    merchantId,
}: {
    merchantId: string;
}) {
    const isDemoMode = useIsDemoMode();
    const { refetch } = useWebhookInteractionStatus({ merchantId });
    return useMutation({
        mutationKey: ["merchant", "webhook-interaction", "delete", merchantId],
        mutationFn: async () => {
            // Return mock success in demo mode
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return { success: true };
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.delete();
            if (error) {
                const errorMsg =
                    typeof error === "string"
                        ? error
                        : "value" in error && typeof error.value === "string"
                          ? error.value
                          : "Failed to delete webhook";
                throw new Error(errorMsg);
            }
            return data;
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
