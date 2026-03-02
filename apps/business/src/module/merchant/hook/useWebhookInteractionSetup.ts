import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWebhookInteractionStatus } from "./useWebhookInteractionStatus";

type WebhookPlatform = "custom" | "shopify" | "woocommerce" | "internal";

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
