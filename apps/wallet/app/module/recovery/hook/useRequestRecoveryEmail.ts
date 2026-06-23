import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";

/**
 * Request the backend to email a recovery backup to a logged-out user.
 *
 * The endpoint is intentionally non-committal: it returns the same
 * acknowledgement whether or not the address is registered, verified, or
 * recoverable, so the UI can only ever show a generic confirmation. The mailed
 * backup is the sole signal that the address was eligible.
 */
export function useRequestRecoveryEmail() {
    const mutation = useMutation({
        mutationKey: recoveryKey.requestEmail,
        mutationFn: async (email: string) => {
            const { data, error } =
                await authenticatedWalletApi.auth.recovery.request.post({
                    email,
                });
            if (error) throw error;
            return data;
        },
    });

    return {
        requestRecoveryEmail: mutation.mutateAsync,
        isRequesting: mutation.isPending,
        isSent: mutation.isSuccess,
        error: mutation.error,
        reset: mutation.reset,
    };
}
