import { authenticatedBackendApi } from "@frak-labs/wallet-shared/common/api/backendClient";
import { transientRetry } from "@frak-labs/wallet-shared/common/api/errors";
import { useQuery } from "@tanstack/react-query";
import {
    fireEnsureActions,
    queuePendingAction,
} from "@/module/pending-actions/drainEnsures";
import type { PendingActionInput } from "@/module/pending-actions/types";

/** Re-asks for an order whose pixel claim or webhook has not landed yet. */
const UNRESOLVED_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000];

const installCode = authenticatedBackendApi.user.identity["install-code"];

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Same code on every attempt: `generate` sits on a 5/min bucket, `resolve` re-runs the order lookup. */
async function redeemTicket(code: string): Promise<string | null> {
    for (const delay of [0, ...UNRESOLVED_RETRY_DELAYS_MS]) {
        if (delay) await sleep(delay);
        const { data, error } = await installCode.resolve.post({ code });
        if (error) throw error;
        if (data.ticket) return data.ticket;
    }
    return null;
}

const oneShot = {
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: transientRetry,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: { storable: false },
} as const;

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
    const { data: code } = useQuery({
        ...oneShot,
        queryKey: [
            "sharing",
            "link-purchase",
            "code",
            merchantId,
            checkoutToken,
        ],
        queryFn: async () => {
            if (!merchantId || !checkoutToken) return null;
            const { data, error } = await installCode.generate.post({
                merchantId,
                checkoutToken,
            });
            if (error) throw error;
            return data.code;
        },
        enabled: enabled && !!merchantId && !!checkoutToken,
    });

    return useQuery({
        ...oneShot,
        queryKey: ["sharing", "link-purchase", "ticket", merchantId, code],
        queryFn: async () => {
            if (!merchantId || !code) return null;
            const ticket = await redeemTicket(code);
            if (!ticket) return null;

            // Queued, not posted: a failed ensure retries on the next launch
            // for the ticket's lifetime, like every other install handoff.
            const action: PendingActionInput = {
                type: "ensure",
                merchantId,
                ticket,
            };
            fireEnsureActions(queuePendingAction(action), action);
            return "queued" as const;
        },
        enabled: !!merchantId && !!code,
    });
}
