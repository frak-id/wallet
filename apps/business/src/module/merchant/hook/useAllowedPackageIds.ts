import type { AllowedPackageId } from "@frak-labs/backend-elysia/api/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { extractAuthErrorCode } from "@/module/auth/utils/authError";
import { merchantByIdQueryKey } from "@/module/merchant/queries/queryKeys";
import { AllowedListError } from "./allowedListError";

export function useAddAllowedPackageId({ merchantId }: { merchantId: string }) {
    const queryClient = useQueryClient();

    return useMutation<void, AllowedListError, AllowedPackageId>({
        mutationKey: ["merchant", "allowed-package-ids", "add", merchantId],
        mutationFn: async (entry: AllowedPackageId) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                ["allowed-package-ids"].post(entry);

            if (error) {
                // Rethrow the backend's typed `code` so the sheet can map the
                // one outcome a user can act on (the app is already claimed)
                // to a translated message.
                throw new AllowedListError(extractAuthErrorCode(error));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: merchantByIdQueryKey(merchantId),
            });
        },
    });
}

export function useRemoveAllowedPackageId({
    merchantId,
}: {
    merchantId: string;
}) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "allowed-package-ids", "remove", merchantId],
        mutationFn: async (entry: AllowedPackageId) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                ["allowed-package-ids"].delete(entry);

            if (error) {
                throw new Error("Failed to remove allowed package id");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: merchantByIdQueryKey(merchantId),
            });
        },
    });
}
