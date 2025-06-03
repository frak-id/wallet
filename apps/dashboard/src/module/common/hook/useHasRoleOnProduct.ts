import { useWalletStatus } from "@frak-labs/react-sdk";
import { businessApi } from "@frak-labs/shared/context/server";
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
    const { data: walletStatus } = useWalletStatus();

    // Query fetching all the roles of a user
    const {
        data: rolesResult,
        isSuccess,
        refetch: refresh,
    } = useQuery({
        queryKey: [
            "product",
            productId,
            "roles",
            wallet ?? "no-given-wallet",
            walletStatus?.wallet ?? "no-frak-wallet",
        ],
        queryFn: async () => {
            const finalWallet = wallet ?? walletStatus?.wallet;
            const { data, error } = await businessApi.roles.index.get({
                query: {
                    productId,
                    ...(finalWallet ? { wallet: finalWallet } : {}),
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
