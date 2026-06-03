import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";

/**
 * Store the encrypted recovery blob on the backend (zero-knowledge: ciphertext
 * only). Returns `{ status: "success" | "alreadyConfigured" }`.
 */
export function useSaveRecoveryBlob() {
    const queryClient = useQueryClient();

    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: recoverySetupKey.saveBlob,
        gcTime: 0,
        mutationFn: async ({ blob }: { blob: string }) => {
            const { data, error } =
                await authenticatedWalletApi.auth.recovery.post({ blob });
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
        saveRecoveryBlob: mutate,
        saveRecoveryBlobAsync: mutateAsync,
    };
}
