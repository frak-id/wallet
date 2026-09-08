import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useStore } from "zustand";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { selectWebauthnSession, sessionStore } from "../../stores/sessionStore";
import { pairingKey } from "../queryKeys";

/**
 * Query options for the active pairings of a wallet.
 *
 * Shared by {@link useGetActivePairings} and the profile route loader so both
 * hit the exact same cache entry (same key + same queryFn).
 */
export function activePairingsQueryOptions(address?: Address) {
    return queryOptions({
        queryKey: pairingKey.listByWallet(address),
        queryFn: async () => {
            const { data } = await authenticatedWalletApi.pairings.list.get();
            if (!data) {
                console.warn("No pairings found");
                return [];
            }
            return data;
        },
        enabled: !!address,
    });
}

/**
 * Get all the active pairings
 */
export function useGetActivePairings() {
    const wallet = useStore(sessionStore, selectWebauthnSession);

    return useQuery(activePairingsQueryOptions(wallet?.address));
}
