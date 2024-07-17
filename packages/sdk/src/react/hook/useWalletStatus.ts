import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { WalletStatusReturnType } from "../../core";
import { watchWalletStatus } from "../../core/actions";
import { ClientNotFound } from "../../core/types/rpc/error";
import { Deferred } from "../../core/utils/Deferred";
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
        queryKey: ["nexus-sdk", "wallet-status-listener"],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Our first result deferred
            const firstResult = new Deferred<WalletStatusReturnType>();
            let hasResolved = false;

            // Setup the listener, with a callback request that will resolve the first result
            await watchWalletStatus(client, (status) => {
                newStatusUpdated(status);

                // If the promise hasn't resolved yet, resolve it
                if (!hasResolved) {
                    firstResult.resolve(status);
                    hasResolved = true;
                }
            });

            // Wait for the first response
            return firstResult.promise;
        },
        enabled: !!client,
    });
}
