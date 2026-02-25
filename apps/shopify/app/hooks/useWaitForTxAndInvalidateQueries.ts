import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { viemClient } from "../utils/viemClient";

export function useWaitForTxAndInvalidateQueries() {
    const queryClient = useQueryClient();

    return useCallback(
        async ({
            hash,
            queryKey,
            confirmations = 16,
        }: {
            hash: Hex;
            queryKey: string[];
            confirmations?: number;
        }) => {
            try {
                await waitForTransactionReceipt(viemClient, {
                    hash,
                    confirmations,
                    retryCount: confirmations,
                });
            } catch {
                // Receipt errors are non-fatal — still invalidate cache
            }

            await queryClient.invalidateQueries({
                queryKey,
                exact: false,
            });
        },
        [queryClient]
    );
}
