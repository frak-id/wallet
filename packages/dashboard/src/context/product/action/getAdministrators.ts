"use server";
import { type RolesKeys, roles } from "@/context/blockchain/roles";
import { indexerApi } from "@frak-labs/shared/context/server";
import { type Address, type Hex, toHex } from "viem";

type ApiResult = {
    wallet: Address;
    isOwner: number; // bool, 0 false 1 true
    roles: string; // bigint
    addedTimestamp: string; // bigint
}[];

/**
 * Get all the administrators of a product
 */
export async function getProductAdministrators({
    productId,
}: { productId: Hex }) {
    console.log(productId);
    // Get our api results
    const json = await indexerApi
        .get(`products/${productId}/administrators`)
        .json<ApiResult>();

    // Parse the roles
    // the roles bigint is bitmasked with every roles repesented on one bit, the list of know roles is stored on roles
    const buildRolesMap = (rolesMask: bigint) => {
        const rolesMap: Record<RolesKeys, boolean> = {
            productManager: false,
            campaignManager: false,
        };
        for (const [role, value] of Object.entries(roles)) {
            rolesMap[role as RolesKeys] = (rolesMask & value) === value;
        }
        return rolesMap;
    };

    // Return that mapped with the right types
    return json.map((result) => ({
        wallet: result.wallet,
        isOwner: result.isOwner === 1,
        roles: toHex(BigInt(result.roles)),
        addedTimestamp: BigInt(result.addedTimestamp),
        roleDetails: {
            admin: result.isOwner === 1,
            ...buildRolesMap(BigInt(result.roles)),
        } as Record<"admin" | RolesKeys, boolean>,
    }));
}
