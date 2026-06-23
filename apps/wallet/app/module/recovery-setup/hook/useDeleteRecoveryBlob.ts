import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";

/**
 * Delete the encrypted recovery blob from the backend. Run after the on-chain
 * executor has been disabled — the blob alone is useless once recovery is off,
 * and the backend delete is idempotent (`{ status: "deleted" }`).
 */
export function useDeleteRecoveryBlob() {
    const queryClient = useQueryClient();

    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: recoverySetupKey.deleteBlob,
        gcTime: 0,
        mutationFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.auth.recovery.delete();
            if (error) throw error;
            return data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: recoverySetupKey.backendStatus,
            });
        },
    });

    return {
        ...mutationStuff,
        deleteRecoveryBlob: mutate,
        deleteRecoveryBlobAsync: mutateAsync,
    };
}
