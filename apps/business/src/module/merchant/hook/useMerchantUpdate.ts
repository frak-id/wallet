import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

type EditMerchantInput = {
    name?: string;
    logoUrl?: string;
    defaultRewardToken?: Address;
};

type EditExplorerInput = {
    enabled?: boolean;
    config?: {
        heroImageUrl?: string;
        heroImageUrls?: string[];
        logoUrl?: string;
        description?: string;
    };
};

type MerchantUpdateInput = EditMerchantInput | EditExplorerInput | SdkConfig;

type MerchantUpdateTarget = "base" | "explorer" | "sdk-config";

async function performUpdate(
    merchantId: string,
    target: MerchantUpdateTarget,
    input: MerchantUpdateInput
) {
    if (target === "base") {
        const { error } = await authenticatedBackendApi
            .merchant({ merchantId })
            .put(input as EditMerchantInput);

        if (error) {
            throw new Error("Failed to update merchant");
        }
    } else if (target === "explorer") {
        const { error } = await authenticatedBackendApi
            .merchant({ merchantId })
            .explorer.put(input as EditExplorerInput);

        if (error) {
            throw new Error("Failed to update explorer settings");
        }
    } else if (target === "sdk-config") {
        const { error } = await authenticatedBackendApi
            .merchant({ merchantId })
            ["sdk-config"].put(input as SdkConfig);

        if (error) {
            throw new Error("Failed to update SDK settings");
        }
    }
}

export function useMerchantUpdate({
    merchantId,
    target,
}: {
    merchantId: string;
    target: MerchantUpdateTarget;
}) {
    const queryClient = useQueryClient();
    const isDemoMode = useIsDemoMode();

    return useMutation({
        mutationKey: ["merchant", target, "edit", merchantId],
        mutationFn: async (input: MerchantUpdateInput) => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                return;
            }

            await performUpdate(merchantId, target, input);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", merchantId],
            });
        },
    });
}
