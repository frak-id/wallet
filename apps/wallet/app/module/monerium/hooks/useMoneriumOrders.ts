import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import {
    getOrders,
    isMoneriumRetryable,
} from "@/module/monerium/utils/moneriumApi";

/**
 * Match `useMoneriumAddresses` cadence. Order state transitions are slow
 * enough (SEPA settlement is hours to days) that a fresh fetch on focus +
 * a 5-minute stale window is plenty.
 */
const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Read the authenticated user's Monerium orders for the currently connected
 * wallet address.
 *
 * Filters via `?address=` so that smart-account users only see orders that
 * originated from their own address — even if the underlying Monerium
 * profile has other linked addresses.
 *
 * See <https://monerium.dev/api-docs/v2> → `GET /orders`.
 */
export function useMoneriumOrders() {
    const { address: walletAddress } = useConnection();
    const isConnected = moneriumStore(isMoneriumConnected);

    const query = useQuery({
        queryKey: moneriumKey.orders.byAddress(walletAddress),
        queryFn: async () => {
            if (!walletAddress) return { orders: [] };
            return getOrders({ address: walletAddress });
        },
        enabled: isConnected && walletAddress !== undefined,
        staleTime: FIVE_MINUTES_MS,
        refetchOnWindowFocus: true,
        retry: (failureCount, err) =>
            failureCount < 3 && isMoneriumRetryable(err),
    });

    return {
        orders: query.data?.orders ?? [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
