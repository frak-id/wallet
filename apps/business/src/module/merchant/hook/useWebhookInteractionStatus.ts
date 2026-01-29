import { useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

export function useWebhookInteractionStatus({
    merchantId,
}: {
    merchantId: string;
}) {
    const isDemoMode = useIsDemoMode();

    return useQuery({
        queryKey: [
            "merchant",
            "webhook-interaction",
            "status",
            merchantId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async () => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return {
                    setup: true as const,
                    platform: "custom" as const,
                    webhookSigninKey: "demo-signing-key-xxxx",
                    stats: {
                        totalPurchaseHandled: 42,
                    },
                };
            }

            const { data: webhookStatus } = await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.get();

            return webhookStatus;
        },
        enabled: !!merchantId,
    });
}
