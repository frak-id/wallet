import {
    authenticatedBackendApi,
    clientIdStore,
    sharingKey,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "zustand";

/**
 * Resolve which anonymous client this sharing page is acting for.
 *
 * Three sources, in strict precedence:
 *
 * 1. the `clientId` param, stated outright by the caller;
 * 2. the wallet's own `clientIdStore`;
 * 3. a backend lookup by Shopify checkout token.
 *
 * A native host states the identity outright, and (2) and (3) must not stand
 * in for it: `clientIdStore` is global rather than merchant-keyed, and a
 * checkout token belongs to whoever happens to be checking out. Substituting
 * either would point `installUrl` and the `ensure` call at the wrong identity
 * — silently, and in the one mode where the wallet cannot see it happen. So
 * under `embed`, the param is the only source consulted.
 */
export function useSharingIdentity({
    merchantId,
    clientId: paramClientId,
    checkoutToken,
    embedded,
}: {
    merchantId?: string;
    clientId?: string;
    checkoutToken?: string;
    /** A host owns the caller identity; the wallet must not guess it. */
    embedded: boolean;
}): string | undefined {
    const storeClientId = useStore(clientIdStore, (s) => s.clientId);

    const mayResolveIdentity = !embedded;
    const immediateClientId = mayResolveIdentity
        ? (paramClientId ?? storeClientId)
        : paramClientId;

    const { data: resolvedClientId } = useQuery({
        queryKey: sharingKey.orderClient(merchantId, checkoutToken),
        queryFn: async () => {
            if (!merchantId || !checkoutToken) return null;
            const { data, error } = await authenticatedBackendApi.user.identity[
                "order-client"
            ].get({
                query: { merchantId, checkoutToken },
            });
            if (error) throw error;
            return data.clientId;
        },
        enabled:
            mayResolveIdentity &&
            !immediateClientId &&
            !!merchantId &&
            !!checkoutToken,
        retry: 5,
        retryDelay: 300,
    });

    return immediateClientId ?? resolvedClientId ?? undefined;
}
