import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";

type EditMerchantInput = {
    name?: string;
    logoUrl?: string;
    defaultRewardToken?: Address;
};

type EditExplorerInput = {
    enabled?: boolean;
    config?: {
        heroImageUrl?: string;
        description?: string;
    };
};

type MerchantUpdateInput = EditMerchantInput | EditExplorerInput | SdkConfig;

export function useMerchantUpdate({
    merchantId,
    target,
}: {
    merchantId: string;
    target: "base" | "explorer" | "sdk-config";
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", target, "edit", merchantId],
        mutationFn: async (input: MerchantUpdateInput) => {
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

            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", merchantId],
            });
        },
    });
}
