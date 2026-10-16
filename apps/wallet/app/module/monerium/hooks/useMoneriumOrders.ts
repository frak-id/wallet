import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { isMoneriumEnabled } from "@/module/monerium/utils/moneriumConfig";
import {
    isMoneriumRetryable,
    unwrapMoneriumResponse,
} from "@/module/monerium/utils/moneriumErrors";
import { useMoneriumStatus } from "./useMoneriumStatus";

/** SEPA settlement takes hours to days: a focus refetch past 5 minutes is plenty. */
const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** Orders of the session wallet, as the backend's flattened DTO. */
export function useMoneriumOrders() {
    const { status } = useMoneriumStatus();
    const isConnected = status?.connection === "connected";

    const query = useQuery({
        queryKey: moneriumKey.orders,
        queryFn: async () => {
            const { orders } = unwrapMoneriumResponse(
                await authenticatedWalletApi.monerium.orders.get()
            );
            return orders;
        },
        enabled: isMoneriumEnabled && isConnected,
        staleTime: FIVE_MINUTES_MS,
        // Counterpart IBANs never reach the persisted query cache.
        meta: { storable: false },
        retry: (failureCount, error) =>
            failureCount < 3 && isMoneriumRetryable(error),
    });

    return {
        orders: query.data ?? [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
