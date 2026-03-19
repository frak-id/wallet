import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWebhookInteractionStatus } from "./useWebhookInteractionStatus";

type WebhookPlatform = "custom" | "shopify" | "woocommerce" | "internal";

type SetupParams = {
    hookSignatureKey: string;
    platform?: WebhookPlatform;
};

type WebhookInteractionMutationParams = {
    merchantId: string;
    action: "setup" | "delete";
};

export function useWebhookInteractionMutation({
    merchantId,
    action,
}: WebhookInteractionMutationParams) {
    const isDemoMode = useIsDemoMode();
    const { refetch } = useWebhookInteractionStatus({ merchantId });

    const setupMutationFn = async ({
        hookSignatureKey,
        platform = "custom",
    }: SetupParams) => {
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
    };

    const deleteMutationFn = async () => {
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
    };

    return useMutation({
        mutationKey: ["merchant", "webhook-interaction", action, merchantId],
        mutationFn:
            action === "setup"
                ? (setupMutationFn as (
                      params: SetupParams | undefined
                  ) => Promise<unknown>)
                : (deleteMutationFn as (
                      params: SetupParams | undefined
                  ) => Promise<unknown>),
        onSettled: async () => {
            await refetch();
        },
    });
}
