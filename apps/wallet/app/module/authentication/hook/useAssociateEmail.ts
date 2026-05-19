import type { AssociateEmailResponse } from "@frak-labs/backend-elysia/api/schemas";
import { authenticatedWalletApi, authKey } from "@frak-labs/wallet-shared";
import {
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";

/**
 * Associate an email with the current authenticator.
 *
 * Three possible outcomes mirror the backend response shape:
 *  - `success`: email saved, query cache for "my email" is updated in-place
 *  - `alreadyHasEmail`: another writer beat us to it; we still refresh the
 *    cache so the UI reflects the persisted value
 *  - `conflict`: the email already belongs to a different wallet; surfaced to
 *    the caller so the eventual merge flow can take over (no-op for now)
 *
 * Validation lives on the form (`EMAIL_REGEX`); bad input would still 422 from
 * the backend, which we surface as a thrown error so the caller can stay on
 * the input step.
 */
export function useAssociateEmail(
    options?: UseMutationOptions<AssociateEmailResponse, Error, string>
) {
    const queryClient = useQueryClient();

    const {
        mutateAsync: associateEmail,
        isPending: isAssociating,
        isError,
        error,
        reset,
        data,
    } = useMutation<AssociateEmailResponse, Error, string>({
        ...options,
        mutationKey: authKey.associateEmail,
        mutationFn: async (email: string) => {
            const { data, error: apiError } =
                await authenticatedWalletApi.auth.email.post({ email });
            if (apiError) throw apiError;
            return data;
        },
        onSuccess: (result, variables, ...rest) => {
            if (
                result.status === "success" ||
                result.status === "alreadyHasEmail"
            ) {
                // Keep the "my email" cache in lock-step with the row we just
                // touched so the wallet card / profile row vanish immediately
                // without waiting for a refetch.
                queryClient.setQueryData(authKey.myEmail, {
                    email: result.email,
                });
            }
            options?.onSuccess?.(result, variables, ...rest);
        },
    });

    return {
        associateEmail,
        isAssociating,
        isError,
        error,
        reset,
        data,
    };
}
