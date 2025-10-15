import { viemClient } from "@backend-common";
import {
    addresses,
    productAdministratorRegistryAbi,
    productRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import {
    type Address,
    concatHex,
    type Hex,
    isAddressEqual,
    keccak256,
    toHex,
} from "viem";
import { multicall } from "viem/actions";

/**
 * The wallet roles on a given provider
 */
type WalletRolesOnProduct = {
    isOwner: boolean;
    roles: bigint;
};

/**
 * Repository used to mint a product
 */
export class RolesRepository {
    // Cache for wallet roles on a product (key = keccak(productId, wallet))
    private readonly productRolesCache = new LRUCache<
        Hex,
        WalletRolesOnProduct
    >({
        max: 1024,
        // ttl of one minute
        ttl: 60_000,
    });

    /**
     * Get the roles of a given wallet on a product
     * @param wallet
     * @param productId
     */
    public async getRolesOnProduct({
        wallet,
        productId,
    }: {
        wallet: Address;
        productId: bigint;
    }) {
        const cacheKey = keccak256(concatHex([wallet, toHex(productId)]));
        const cached = this.productRolesCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Fetch the roles of the user on the product
        const [productOwner, walletRoles] = await multicall(viemClient, {
            contracts: [
                {
                    abi: productRegistryAbi,
                    address: addresses.productRegistry,
                    functionName: "ownerOf",
                    args: [productId],
                },
                {
                    abi: productAdministratorRegistryAbi,
                    address: addresses.productAdministratorRegistry,
                    functionName: "rolesOf",
                    args: [productId, wallet],
                },
            ],
            allowFailure: false,
        });

        const roles = {
            isOwner: isAddressEqual(productOwner, wallet),
            roles: walletRoles,
        };
        this.productRolesCache.set(cacheKey, roles);
        return roles;
    }

    /**
     * Check if a user has the given roles on a product or not
     * @param wallet
     * @param productId
     * @param role
     */
    public async hasRoleOrAdminOnProduct({
        wallet,
        productId,
        role,
    }: {
        wallet: Address;
        productId: bigint;
        role: bigint;
    }) {
        const { isOwner, roles } = await this.getRolesOnProduct({
            wallet,
            productId,
        });
        return isOwner || this.hasRolesOrAdmin({ onChainRoles: roles, role });
    }

    /**
     * Helper function to check if a user has a given role
     * @param onChainRoles
     * @param role
     */
    hasRoles({ onChainRoles, role }: { onChainRoles: bigint; role: bigint }) {
        return (onChainRoles & role) !== 0n;
    }

    /**
     * Helper function to check if a user has a given role or is an admin
     * @param onChainRoles
     * @param role
     */
    hasRolesOrAdmin({
        onChainRoles,
        role,
    }: {
        onChainRoles: bigint;
        role: bigint;
    }) {
        return this.hasRoles({
            onChainRoles,
            role: role | productRoles.productAdministrator,
        });
    }
}

export const rolesRepository = new RolesRepository();
