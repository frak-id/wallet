import { viemClient } from "@/context/blockchain/provider";
import { useQueryClient } from "@tanstack/react-query";
import { guard } from "radash";
import { useCallback } from "react";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

/**
 * wait for a transaction confirmations and invalide some queries
 */
export function useWaitForTxAndInvalidateQueries() {
    const queryClient = useQueryClient();

    return useCallback(
        async ({ hash, queryKey }: { hash: Hex; queryKey: string[] }) => {
            // Wait a bit for the tx to be confirmed
            await guard(() =>
                waitForTransactionReceipt(viemClient, {
                    hash,
                    confirmations: 16,
                    retryCount: 32,
                })
            );

            // Invalidate related query
            await queryClient.invalidateQueries({
                queryKey,
                exact: false,
            });
        },
        [queryClient]
    );
}
