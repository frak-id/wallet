import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { installCodeKey } from "@/module/recovery-code/queryKeys/install-code";

type ResolveResult = {
    merchantId: string;
    anonymousId: string;
    merchant: { name: string; domain: string };
};

/**
 * Hook to resolve an install code via the backend.
 * On success, adds a pending ensure action to `pendingActionsStore`
 * so the anonymous identity will be merged with the wallet after auth.
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

            // Add ensure action for post-auth identity merge
            pendingActionsStore.getState().addAction({
                type: "ensure",
                merchantId: data.merchantId,
                anonymousId: data.anonymousId,
                merchant: data.merchant,
            });

            return data;
        },
    });

    return { resolve, resolveAsync, ...mutationState };
}
