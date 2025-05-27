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
        async ({
            hash,
            queryKey,
            confirmations = 16,
        }: { hash: Hex; queryKey: string[]; confirmations?: number }) => {
            // Wait a bit for the tx to be confirmed
            await guard(() =>
                waitForTransactionReceipt(viemClient, {
                    hash,
                    confirmations: confirmations,
                    retryCount: confirmations,
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
