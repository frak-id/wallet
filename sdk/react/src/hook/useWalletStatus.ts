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
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.watchWalletStatus | `watchWalletStatus()`} action
 *
 * @group hooks
 *
 * @returns
 * The query hook wrapping the `watchWalletStatus()` action
 * The `data` result is a {@link @frak-labs/core-sdk!index.WalletStatusReturnType | `WalletStatusReturnType`}
 *
 * @see {@link @frak-labs/core-sdk!actions.watchWalletStatus | `watchWalletStatus()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useQuery | `useQuery()`} for more info about the useQuery response
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
