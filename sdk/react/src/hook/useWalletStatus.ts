import {
    ClientNotFound,
    type WalletStatusReturnType,
} from "@frak-labs/core-sdk";
import { watchWalletStatus } from "@frak-labs/core-sdk/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useFrakClient } from "./useFrakClient";

/**
 * Hook that return a query helping to get the current wallet status.
 * The query result will be updated when the wallet status changes.
 *
 * @see {@link watchWalletStatus} for more info about the underlying action
 * @see [Tanstack Query - Query](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery) for more info about the useQuery and response
 */
export function useWalletStatus() {
    const queryClient = useQueryClient();
    const client = useFrakClient();

    /**
     * Callback hook when we receive an updated wallet status
     */
    const newStatusUpdated = useCallback(
        (event: WalletStatusReturnType) => {
            queryClient.setQueryData(
                ["frak-sdk", "wallet-status-listener"],
                event
            );
        },
        [queryClient]
    );

    /**
     * Setup the query listener
     */
    return useQuery<WalletStatusReturnType>({
        gcTime: 0,
        staleTime: 0,
        queryKey: ["frak-sdk", "wallet-status-listener"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }

            return watchWalletStatus(client, newStatusUpdated);
        },
        enabled: !!client,
    });
}
