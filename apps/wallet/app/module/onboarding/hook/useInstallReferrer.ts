import { isAndroid, isTauri } from "@frak-labs/app-essentials/utils/platform";
import {
    authenticatedBackendApi,
    clientIdStore,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { getInstallReferrer } from "../utils/installReferrer";

type ReferrerData = {
    merchantId: string;
    anonymousId: string;
    merchant?: { name: string; domain: string };
};

/**
 * On Tauri+Android, reads the Play Store install referrer, resolves merchant
 * info from the backend, and stores a pending ensure action + client ID.
 *
 * Mirrors what `useResolveInstallCode` does for the manual code flow.
 */
export function useInstallReferrer() {
    return useQuery<ReferrerData | null>({
        queryKey: ["install-referrer"],
        queryFn: async () => {
            const { referrer } = await getInstallReferrer();
            const params = new URLSearchParams(referrer);
            const merchantId = params.get("merchantId");
            const anonymousId = params.get("anonymousId");
            if (!merchantId || !anonymousId) return null;

            // Resolve merchant info for display + pending action metadata
            const { data } =
                await authenticatedBackendApi.user.merchant.resolve.get({
                    query: { merchantId },
                });
            const merchant = data
                ? { name: data.name, domain: data.domain }
                : undefined;

            // Store ensure action (deduped, persisted, survives crashes)
            pendingActionsStore.getState().addAction({
                type: "ensure",
                merchantId,
                anonymousId,
                merchant,
            });
            clientIdStore.getState().setClientId(anonymousId);

            return { merchantId, anonymousId, merchant };
        },
        enabled: isTauri() && isAndroid(),
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
        meta: { storable: false },
    });
}
