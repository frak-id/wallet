import { transientRetry } from "@frak-labs/wallet-shared/common";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { useQuery } from "@tanstack/react-query";
import {
    fireEnsureActions,
    queuePendingAction,
} from "@/module/pending-actions/drainEnsures";
import type { PendingActionInput } from "@/module/pending-actions/types";

/**
 * Link the buyer's purchase identity to the signed-in wallet. This page holds
 * no keypair, so the order's `checkoutToken` is the only credential: it goes
 * through the same code → ticket → ensure chain as the install flow.
 */
export function useLinkPurchaseIdentity({
    merchantId,
    checkoutToken,
    enabled,
}: {
    merchantId?: string;
    checkoutToken?: string;
    /** Needs a wallet session: `ensure` links to the caller's wallet. */
    enabled: boolean;
}) {
    return useQuery({
        queryKey: ["sharing", "link-purchase", merchantId, checkoutToken],
        queryFn: async () => {
            if (!merchantId || !checkoutToken) return null;
            const installCode =
                authenticatedBackendApi.user.identity["install-code"];

            const { data: minted, error: mintError } =
                await installCode.generate.post({ merchantId, checkoutToken });
            if (mintError) throw mintError;

            const { data: resolved, error: resolveError } =
                await installCode.resolve.post({ code: minted.code });
            if (resolveError) throw resolveError;
            // `UNRESOLVED`: the order names no identity yet, nothing to link.
            if (!resolved.ticket) return null;

            // Queued, not posted: a failed ensure retries on the next launch
            // for the ticket's lifetime, like every other install handoff.
            const action: PendingActionInput = {
                type: "ensure",
                merchantId,
                ticket: resolved.ticket,
            };
            fireEnsureActions(queuePendingAction(action), action);
            return "queued" as const;
        },
        enabled: enabled && !!merchantId && !!checkoutToken,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        retry: transientRetry,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        meta: { storable: false },
    });
}
