import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { WalletStatusReturnType } from "../../core";
import { walletStatus } from "../../core/actions";
import { ClientNotFound } from "../../core/types/rpc/error";
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

            return walletStatus(client, newStatusUpdated);
        },
        enabled: !!client,
    });
}
