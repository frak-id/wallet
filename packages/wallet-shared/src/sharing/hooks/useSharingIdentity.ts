import { isServerMintedId } from "@frak-labs/app-essentials/constants/serverMintedId";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "zustand";
import { authenticatedBackendApi } from "../../common/api/backendClient";
import { getErrorStatus } from "../../common/api/errors";
import { clientIdStore } from "../../stores/clientIdStore";
import { sharingKey } from "../queryKeys";

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

            // A server-minted id is keyless, and the FrakContext v2 codec
            // encodes UUIDs only, so one cannot ride a share link: keeping it
            // would swap a null link for an id that dies inside the encoder.
            // Backend-side this is a 404; discarding it here needs no deploy.
            return isServerMintedId(data.clientId) ? null : data.clientId;
        },
        enabled:
            mayResolveIdentity &&
            !immediateClientId &&
            !!merchantId &&
            !!checkoutToken,
        // A 404 is the webhook-not-landed race, worth a few tries; a 5xx is a
        // deploy blip, worth one. Everything else is terminal — a 429 above
        // all, since retrying it only deepens the 10/min bucket it reports.
        retry: (failureCount, error) => {
            const status = getErrorStatus(error);
            if (status === 404) return failureCount < 3;
            return status !== undefined && status >= 500 && failureCount < 2;
        },
        retryDelay: (attempt) => 300 * 2 ** attempt,
    });

    return immediateClientId ?? resolvedClientId ?? undefined;
}
