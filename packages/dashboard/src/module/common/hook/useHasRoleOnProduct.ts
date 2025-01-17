import { backendApi } from "@frak-labs/shared/context/server";
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";

const defaultRoles = {
    roles: 0n,
    isOwner: false,
    isAdministrator: false,
    isInteractionManager: false,
    isCampaignManager: false,
};

/**
 * Check the wallet roles on a given product
 */
export function useHasRoleOnProduct({
    productId,
    wallet,
}: { productId: Hex; wallet?: Address }) {
    // Query fetching all the roles of a user
    const {
        data: rolesResult,
        isSuccess,
        refetch: refresh,
    } = useQuery({
        queryKey: ["product", productId, "roles", wallet ?? "no-given-wallet"],
        queryFn: async () => {
            const { data, error } = await backendApi.business.roles.index.get({
                query: {
                    productId,
                    ...(wallet ? { wallet } : {}),
                },
            });
            if (!data) {
                console.warn("Error when fetching user roles", error);
                return defaultRoles;
            }

            return data;
        },
    });

    return {
        refresh,
        rolesReady: isSuccess,
        ...(rolesResult ?? defaultRoles),
    };
}
