import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    usePurchaseWebhookStatus,
    type WebhookPlatform,
} from "@/module/merchant/hook/usePurchaseWebhookStatus";

export function useWebhookSetup({ merchantId }: { merchantId: string }) {
    const { refetch } = usePurchaseWebhookStatus({ merchantId });
    return useMutation({
        mutationKey: ["merchant", "webhook", "setup", merchantId],
        mutationFn: async ({
            webhookKey,
            platform,
        }: {
            webhookKey: string;
            platform: WebhookPlatform;
        }) => {
            await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.post({
                    hookSignatureKey: webhookKey,
                    platform,
                });
        },
        onSettled: async () => {
            await refetch();
        },
    });
}
