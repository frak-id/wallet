import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import { merchantTeamQueryKey } from "@/module/merchant/queries/queryKeys";

type AddAdminArg =
    | { merchantId: string; wallet: Address }
    | { merchantId: string; email: string };

type RemoveAdminArg = { merchantId: string; adminId: string };

type AdminMutationArg = AddAdminArg | RemoveAdminArg;

type AdminMutationOptions = {
    action: "add" | "remove";
};

/** `POST /admins` response — additive `status` distinguishes a direct add
 * from a merchant-team invitation sent to a not-yet-registered email. */
export type AddAdminResult = {
    id: string;
    status: "active" | "invited";
};

export function useAdminMutation({ action }: AdminMutationOptions) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: [
            "merchant",
            action === "add" ? "add-member" : "remove-member",
        ],
        mutationFn: async (
            args: AdminMutationArg
        ): Promise<AddAdminResult | undefined> => {
            if (action === "add") {
                const addArgs = args as AddAdminArg;
                const { data, error } = await authenticatedBackendApi
                    .merchant({ merchantId: addArgs.merchantId })
                    .admins.post(
                        "wallet" in addArgs
                            ? { wallet: addArgs.wallet }
                            : { email: addArgs.email }
                    );

                // Throw the raw Eden error (not a generic Error) so callers
                // can surface the backend's message (e.g. the 404 "no account
                // found for this email") via `extractAuthErrorMessage`.
                if (!data || error) {
                    throw error ?? new Error("Failed to add admin");
                }

                return data;
            }

            const removeArgs = args as RemoveAdminArg;
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId: removeArgs.merchantId })
                .admins({ adminId: removeArgs.adminId })
                .delete();

            if (error) {
                throw error;
            }
            return undefined;
        },
        onSuccess: (_data, args) => {
            queryClient.invalidateQueries({
                queryKey: merchantTeamQueryKey(args.merchantId),
            });
        },
    });
}
