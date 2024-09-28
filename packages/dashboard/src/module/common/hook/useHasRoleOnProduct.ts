import { viemClient } from "@/context/blockchain/provider";
import {
    addresses,
    productAdministratorRegistryAbi,
    productRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { type Hex, isAddressEqual } from "viem";
import { multicall } from "viem/actions";

/**
 * Check the wallet roles on a given product
 */
export function useHasRoleOnProduct({ productId }: { productId: Hex }) {
    const { data: walletStatus } = useWalletStatus();

    // Query fetching all the roles of a user
    const {
        data: rolesResult,
        isSuccess,
        refetch: refresh,
    } = useQuery({
        enabled: !!walletStatus,
        queryKey: ["product", productId, "roles", walletStatus?.key],
        queryFn: async () => {
            if (walletStatus?.key !== "connected") {
                return {
                    isOwner: false,
                    isAdministrator: false,
                    roles: 0n,
                };
            }

            const [productOwner, walletRoles] = await multicall(viemClient, {
                contracts: [
                    {
                        abi: productRegistryAbi,
                        address: addresses.productRegistry,
                        functionName: "ownerOf",
                        args: [BigInt(productId)],
                    },
                    {
                        abi: productAdministratorRegistryAbi,
                        address: addresses.productAdministratorRegistry,
                        functionName: "rolesOf",
                        args: [BigInt(productId), walletStatus.wallet],
                    },
                ],
                allowFailure: false,
            });
            const isOwner = isAddressEqual(productOwner, walletStatus.wallet);

            return {
                isOwner,
                isAdministrator:
                    isOwner ||
                    (walletRoles & productRoles.productAdministrator) !== 0n,
                roles: walletRoles,
            };
        },
    });

    // Helper checking if the current user has the given role or is the owner
    const hasRolesOrOwner = useCallback(
        (role: bigint) => {
            if (!rolesResult) return false;

            return rolesResult.isOwner || (rolesResult.roles & role) !== 0n;
        },
        [rolesResult]
    );

    // Helper checking if the current user has the given role or is the owner
    const hasRolesOrAdminOrOwner = useCallback(
        (role: bigint) => {
            // If he is not the owner, check if he has the given role, or the admin roles
            return hasRolesOrOwner(role | productRoles.productAdministrator);
        },
        [hasRolesOrOwner]
    );

    return {
        refresh,
        rolesReady: isSuccess,
        isAdministrator: rolesResult?.isAdministrator ?? false,
        hasRolesOrOwner,
        hasRolesOrAdminOrOwner,
    };
}
