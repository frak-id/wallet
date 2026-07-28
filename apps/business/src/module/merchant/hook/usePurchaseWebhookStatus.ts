import { useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { merchantPurchaseWebhookStatusQueryKey } from "@/module/merchant/queries/queryKeys";

export type WebhookPlatform =
    | "shopify"
    | "woocommerce"
    | "magento"
    | "custom"
    | "internal";

export type WebhookStatus =
    | { setup: false }
    | {
          setup: true;
          platform: WebhookPlatform;
          webhookSigninKey?: string;
          stats?: {
              firstPurchase?: Date;
              lastPurchase?: Date;
              lastUpdate?: Date;
              totalPurchaseHandled?: number;
          };
      };

export function usePurchaseWebhookStatus({
    merchantId,
}: {
    merchantId: string;
}) {
    const isDemoMode = useIsDemoMode();

    return useQuery({
        enabled: !!merchantId,
        queryKey: merchantPurchaseWebhookStatusQueryKey(merchantId, isDemoMode),
        queryFn: async (): Promise<WebhookStatus> => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return {
                    setup: true,
                    platform: "custom",
                    webhookSigninKey: "demo-signing-key-xxxx",
                    stats: {
                        totalPurchaseHandled: 42,
                    },
                };
            }

            const { data: webhookStatus } = await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.get();

            if (!webhookStatus?.setup) {
                return { setup: false };
            }

            return webhookStatus as WebhookStatus;
        },
    });
}
