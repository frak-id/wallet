import type { EmailStatusResponse } from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedWalletApi, authKey } from "@frak-labs/wallet-shared";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

/**
 * Pre-registration email check.
 *
 * Hits `/auth/emailStatus` to find out whether the email is already attached
 * to a credential. When it is, the backend echoes the credential id (and the
 * smart wallet address when known) so the UI can offer a targeted login.
 *
 * Validation lives on the form (`EMAIL_REGEX`) — bad input still returns a
 * 422 from the backend, surfaced here as a thrown error so the caller can
 * keep the user on the email step.
 */
export function useCheckEmail(
    options?: UseMutationOptions<EmailStatusResponse, Error, string>
) {
    const {
        mutateAsync: checkEmail,
        isPending: isChecking,
        isError,
        error,
        reset,
    } = useMutation<EmailStatusResponse, Error, string>({
        ...options,
        mutationKey: authKey.checkEmail,
        mutationFn: async (email: string) => {
            const { data, error: apiError } =
                await authenticatedWalletApi.auth.emailStatus.post({ email });
            if (apiError) throw apiError;
            return data;
        },
    });

    return { checkEmail, isChecking, isError, error, reset };
}
