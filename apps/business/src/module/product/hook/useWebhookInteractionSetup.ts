import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWebhookInteractionStatus } from "@/module/product/hook/useWebhookInteractionStatus";

type WebhookPlatform = "custom" | "shopify" | "woocommerce" | "internal";

/**
 * Hook to setup the webhook interaction
 */
export function useWebhookInteractionSetup({
    merchantId,
}: {
    merchantId: string;
}) {
    const isDemoMode = useIsDemoMode();
    const { refetch } = useWebhookInteractionStatus({ merchantId });
    return useMutation({
        mutationKey: ["merchant", "webhook-interaction", "setup", merchantId],
        mutationFn: async ({
            hookSignatureKey,
            platform = "custom",
        }: {
            hookSignatureKey: string;
            platform?: WebhookPlatform;
        }) => {
            // Return mock success in demo mode
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                return { success: true };
            }

            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.post({
                    hookSignatureKey,
                    platform,
                });
            if (error) {
                const errorMsg =
                    typeof error === "string"
                        ? error
                        : "value" in error && typeof error.value === "string"
                          ? error.value
                          : "Failed to setup webhook";
                throw new Error(errorMsg);
            }
            return data;
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
