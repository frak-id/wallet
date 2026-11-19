import {
    authenticatedBackendApi,
    getErrorCode,
    type InstallCodeSurface,
    setInstallSource,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { installCodeKey } from "@/module/reward-code/queryKeys/install-code";

type ResolveResult = {
    merchantId: string;
    merchant: { name: string; domain: string };
    /** Optional defensively: an old backend or a rollback never sends one. */
    ticket?: string;
    /** The code named a row whose credential the backend could not resolve. */
    outcome?: "UNRESOLVED";
};

type UseResolveInstallCodeOptions = UseMutationOptions<
    ResolveResult,
    Error,
    string
> & { surface?: InstallCodeSurface };

/**
 * Hook to resolve an install code via the backend. A resolved code queues a
 * pending ensure action so its anonymous identity is merged after auth; an
 * `UNRESOLVED` one queues nothing and leaves the page on its download CTA.
 */
export function useResolveInstallCode({
    surface = "reward_code",
    ...options
}: UseResolveInstallCodeOptions = {}) {
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
                const errorCode = getErrorCode(error) ?? "unknown";
                // A code meant for the other field is handed on, not a failed install code.
                const isWrongField =
                    errorCode === "REFERRAL_CODE" ||
                    (surface === "referral_code" &&
                        errorCode === "CODE_NOT_FOUND");
                if (!isWrongField) {
                    trackEvent("install_code_resolve_failed", {
                        error_code: errorCode,
                    });
                }
                throw error;
            }

            trackEvent("install_code_resolved", {
                has_wallet: Boolean(data.hasWallet),
                merchant_domain: data.merchant.domain,
                outcome: data.outcome ?? "RESOLVED",
                surface,
            });
            setInstallSource("install_code");

            // The ticket IS the credential here: it resolves its own id
            // server-side and 400s on a mismatch. An `UNRESOLVED` row mints
            // none, so queueing one would retry for the store's full TTL.
            if (data.ticket) {
                pendingActionsStore.getState().addAction({
                    type: "ensure",
                    merchantId: data.merchantId,
                    merchant: data.merchant,
                    ticket: data.ticket,
                });
            }

            return data;
        },
    });

    return { resolve, resolveAsync, ...mutationState };
}
