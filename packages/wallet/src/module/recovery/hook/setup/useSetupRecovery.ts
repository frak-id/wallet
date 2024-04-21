import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useAccount, useSendTransaction } from "wagmi";

/**
 * Setup the recovery for the given chain
 */
export function useSetupRecovery() {
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();
    const queryClient = useQueryClient();

    /**
     * Perform the recovery setup
     */
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: ["recovery", "setup", address],
        gcTime: 0,
        mutationFn: async ({
            chainId,
            setupTxData,
        }: { chainId: number; setupTxData: Hex }) => {
            if (!address) return null;

            // Perform the setup transaction
            const txHash = await sendTransactionAsync({
                to: address,
                data: setupTxData,
                chainId,
            });

            // Invalidate the recovery options for the given chain
            await queryClient.invalidateQueries({
                queryKey: ["recovery", "status", address, chainId],
                exact: true,
            });

            return txHash;
        },
    });

    return {
        ...mutationStuff,
        setupRecoveryAsync: mutateAsync,
        setupRecovery: mutate,
    };
}
