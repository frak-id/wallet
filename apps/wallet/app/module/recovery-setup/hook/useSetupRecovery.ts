import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";
import {
    type DefaultError,
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import type { Hex } from "viem";
import { useAccount, useSendTransaction } from "wagmi";

type MutationParams = {
    setupTxData: Hex;
};
/**
 * Setup the recovery
 */
export function useSetupRecovery(
    options?: UseMutationOptions<Hex | null, DefaultError, MutationParams>
) {
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();
    const queryClient = useQueryClient();

    /**
     * Perform the recovery setup
     */
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        ...options,
        mutationKey: recoverySetupKey.setup(address),
        gcTime: 0,
        mutationFn: async ({ setupTxData }: MutationParams) => {
            if (!address) return null;

            // Perform the setup transaction
            const txHash = await sendTransactionAsync({
                to: address,
                data: setupTxData,
            });

            // Invalidate the recovery options for the given chain
            await queryClient.invalidateQueries({
                queryKey: recoverySetupKey.status(address),
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
