import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { WalletStatusReturnType } from "../../core";
import { watchWalletStatus } from "../../core/actions";
import { useNexusClient } from "./useNexusClient";

export type WalletStatusQueryReturnType =
    | WalletStatusReturnType
    | {
          key: "waiting-response";
      };

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
            queryClient.setQueryData(["walletStatusListener"], event);
        },
        [queryClient]
    );

    /**
     * Setup the query listener
     */
    return useQuery<WalletStatusQueryReturnType>({
        gcTime: 0,
        queryKey: ["walletStatusListener"],
        queryFn: async () => {
            // Setup the listener
            await watchWalletStatus(client, newStatusUpdated);
            // Wait for the first response
            return { key: "waiting-response" };
        },
    });
}
