import { useQuery } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { selectWebauthnSession, sessionStore } from "../../stores/sessionStore";
import { pairingKey } from "../queryKeys";

/**
 * Get all the active pairings
 */
export function useGetActivePairings() {
    const wallet = sessionStore(selectWebauthnSession);

    return useQuery({
        queryKey: pairingKey.listByWallet(wallet?.address),
        queryFn: async () => {
            const { data } = await authenticatedWalletApi.pairings.list.get();
            if (!data) {
                console.warn("No pairings found");
                return null;
            }
            return data;
        },
        enabled: !!wallet?.address,
    });
}
