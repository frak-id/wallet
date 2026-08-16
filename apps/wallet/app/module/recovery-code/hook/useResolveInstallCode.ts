import {
    authenticatedBackendApi,
    setInstallSource,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { installCodeKey } from "@/module/recovery-code/queryKeys/install-code";

type ResolveResult = {
    merchantId: string;
    /** Absent together with `ticket` when the outcome is `UNRESOLVED`. */
    anonymousId?: string;
    merchant: { name: string; domain: string };
    /** Optional defensively: an old backend or a rollback never sends one. */
    ticket?: string;
    /** The code named a row whose credential the backend could not resolve. */
    outcome?: "UNRESOLVED";
};

/**
 * Hook to resolve an install code via the backend. A resolved code queues a
 * pending ensure action so its anonymous identity is merged after auth; an
 * `UNRESOLVED` one queues nothing and leaves the page on its download CTA.
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
                trackEvent("install_code_resolve_failed", {
                    error_code:
                        (error as { value?: { code?: string } })?.value?.code ??
                        "unknown",
                });
                throw error;
            }

            trackEvent("install_code_resolved", {
                has_wallet: Boolean(data.hasWallet),
                merchant_domain: data.merchant.domain,
                outcome: data.outcome ?? "RESOLVED",
            });
            setInstallSource("install_code");

            // An `UNRESOLVED` row names no identity, so there is nothing to
            // ensure; queueing one would retry for the store's full 7-day TTL.
            //
            // No `proof` on the resolved arm: the ticket, minted from the
            // code's row, is this path's credential.
            if (data.anonymousId) {
                pendingActionsStore.getState().addAction({
                    type: "ensure",
                    merchantId: data.merchantId,
                    anonymousId: data.anonymousId,
                    merchant: data.merchant,
                    ticket: data.ticket,
                });
            }

            return data;
        },
    });

    return { resolve, resolveAsync, ...mutationState };
}
