import {
    type DefaultError,
    type UseMutationOptions,
    useMutation,
} from "@tanstack/react-query";
import type { Hex } from "viem";
import { useConnection, useSendTransaction } from "wagmi";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";

type MutationParams = {
    setupTxData: Hex;
};
/**
 * Setup the recovery
 */
export function useSetupRecovery(
    options?: UseMutationOptions<Hex | null, DefaultError, MutationParams>
) {
    const { address } = useConnection();
    const { mutateAsync: sendTransactionAsync } = useSendTransaction();

    /**
     * Perform the recovery setup
     */
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        ...options,
        mutationKey: recoverySetupKey.setup(address),
        gcTime: 0,
        mutationFn: async ({ setupTxData }: MutationParams, { client }) => {
            if (!address) return null;

            // Perform the setup transaction
            const txHash = await sendTransactionAsync({
                to: address,
                data: setupTxData,
            });

            await client.invalidateQueries({
                queryKey: recoveryKey.currentOption.full({
                    walletAddress: address,
                }),
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
