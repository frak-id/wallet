import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { installCodeKey } from "@/module/recovery-code/queryKeys/install-code";
import { installCodeStore } from "@/module/recovery-code/stores/installCodeStore";

type ResolveResult = {
    merchantId: string;
    merchant: { name: string; domain: string };
};

/**
 * Hook to resolve an install code via the backend.
 *
 * On success, stores the resolved data (code + merchant info) in the
 * persisted `installCodeStore` so it can be consumed after registration.
 */
export function useResolveInstallCode(
    options?: UseMutationOptions<ResolveResult, Error, string>
) {
    const {
        mutate: resolve,
        mutateAsync: resolveAsync,
        ...mutationState
    } = useMutation({
        ...options,
        mutationKey: installCodeKey.resolve,
        mutationFn: async (code: string) => {
            const { data, error } = await authenticatedBackendApi.user.identity[
                "install-code"
            ].resolve.post({ code });

            if (error) {
                throw error;
            }

            // Store the resolved code for post-registration consumption
            installCodeStore.getState().setPendingCode({
                code,
                merchantId: data.merchantId,
                merchant: data.merchant,
            });

            return data;
        },
    });

    return { resolve, resolveAsync, ...mutationState };
}
