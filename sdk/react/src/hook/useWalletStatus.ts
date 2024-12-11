import {
    ClientNotFound,
    type WalletStatusReturnType,
} from "@frak-labs/core-sdk";
import { watchWalletStatus } from "@frak-labs/core-sdk/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNexusClient } from "./useNexusClient";

/**
 * Hooks used to listen to the current wallet status
 */
export function useWalletStatus() {
    const queryClient = useQueryClient();
    const client = useNexusClient();

    /**
     * Callback hook when we receive an updated wallet status
     */
    const newStatusUpdated = useCallback(
        (event: WalletStatusReturnType) => {
            queryClient.setQueryData(
                ["nexus-sdk", "wallet-status-listener"],
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
        queryKey: ["nexus-sdk", "wallet-status-listener"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }

            return watchWalletStatus(client, newStatusUpdated);
        },
        enabled: !!client,
    });
}
