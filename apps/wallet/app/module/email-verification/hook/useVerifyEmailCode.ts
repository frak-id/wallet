import type {
    MyEmailResponse,
    VerifyEmailResponse,
} from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedWalletApi, authKey } from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useVerifyEmailCode() {
    const queryClient = useQueryClient();

    return useMutation<VerifyEmailResponse, Error, string>({
        mutationKey: authKey.verifyEmail,
        mutationFn: async (code) => {
            const { data, error } =
                await authenticatedWalletApi.auth.email.verify.post({ code });
            if (error) throw error;
            return data;
        },
        onSuccess: (result) => {
            if (result.status !== "verified") return;
            queryClient.setQueryData<MyEmailResponse>(authKey.myEmail, {
                email: result.email,
                verified: true,
                verifiedAt: result.verifiedAt,
                pendingEmail: null,
            });
        },
    });
}
