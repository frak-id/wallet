import {
    authenticatedBackendApi,
    clientIdStore,
    sharingKey,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "zustand";

/**
 * Resolve which anonymous client this page acts for: the `clientId` param, then
 * `clientIdStore`, then a backend lookup by checkout token. Under `embed` only
 * the param counts — the other two can name the wrong identity.
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
