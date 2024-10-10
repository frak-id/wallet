import { viemClient } from "@/context/blockchain/provider";
import {
    addresses,
    productAdministratorRegistryAbi,
    productRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { type Address, type Hex, isAddressEqual } from "viem";
import { multicall } from "viem/actions";

function hasRoles({
    onChainRoles,
    role,
}: { onChainRoles: bigint; role: bigint }) {
    return (onChainRoles & role) !== 0n;
}

function hasRolesOrAdmin({
    onChainRoles,
    role,
}: { onChainRoles: bigint; role: bigint }) {
    return hasRoles({
        onChainRoles,
        role: role | productRoles.productAdministrator,
    });
}

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
        enabled: !!walletStatus,
        queryKey: [
            "product",
            productId,
            "roles",
            walletStatus?.wallet,
            wallet ?? "no-given-wallet",
        ],
        queryFn: async () => {
            const walletToQuery = wallet ?? walletStatus?.wallet;
            if (!walletToQuery) {
                return defaultRoles;
            }

            // Fetch the roles of the user on the product
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
                        args: [BigInt(productId), walletToQuery],
                    },
                ],
                allowFailure: false,
            });

            // Build our role maps
            const isOwner = isAddressEqual(productOwner, walletToQuery);
            const isAdministrator =
                isOwner ||
                hasRoles({
                    onChainRoles: walletRoles,
                    role: productRoles.productAdministrator,
                });
            const isInteractionManager =
                isOwner ||
                hasRolesOrAdmin({
                    onChainRoles: walletRoles,
                    role: productRoles.interactionManager,
                });
            const isCampaignManager =
                isOwner ||
                hasRolesOrAdmin({
                    onChainRoles: walletRoles,
                    role: productRoles.campaignManager,
                });

            // Return the roles
            return {
                roles: walletRoles,
                // Can do anything
                isOwner,
                // Can't update product metadata, but can otherwise do anything (even manage team members)
                isAdministrator,
                // Can update, deploy and delete interaction contracts
                isInteractionManager,
                // Can update, deploy, and delete campaigns
                isCampaignManager,
            };
        },
    });

    return {
        refresh,
        rolesReady: isSuccess,
        ...(rolesResult ?? defaultRoles),
    };
}
