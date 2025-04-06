import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { authenticatedBackendApi } from "../../common/api/backendClient";
import { webauthnSessionAtom } from "../../common/atoms/session";
import { pairingKey } from "../queryKeys";

/**
 * Get all the active pairings
 */
export function useGetActivePairings() {
    const wallet = useAtomValue(webauthnSessionAtom);

    return useQuery({
        queryKey: pairingKey.listByWallet(wallet?.address),
        queryFn: async () => {
            const { data } = await authenticatedBackendApi.pairings.list.get();
            if (!data) {
                console.warn("No pairings found");
                return null;
            }
            return data;
        },
    });
}
