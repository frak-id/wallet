"use server";
import { getAdministratorsMock } from "@/context/product/action/mock";
import { isDemoModeActive } from "@/module/common/utils/isDemoMode";
import { type ProductRolesKey, productRoles } from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/client/server";
import { type Address, type Hex, toHex } from "viem";

type ApiResult = {
    wallet: Address;
    isOwner: boolean;
    roles: string; // bigint
    addedTimestamp: string; // bigint
}[];

/**
 * Get all the administrators of a product
 */
export async function getProductAdministrators({
    productId,
}: { productId: Hex }) {
    // Check if demo mode is active
    if (await isDemoModeActive()) {
        return getAdministratorsMock();
    }

    console.log(productId);
    // Get our api results
    const json = await indexerApi
        .get(`products/${productId}/administrators`)
        .json<ApiResult>();

    // Parse the roles
    // the roles bigint is bitmasked with every roles repesented on one bit, the list of know roles is stored on roles
    const buildRolesMap = (rolesMask: bigint) => {
        const rolesMap: Record<ProductRolesKey, boolean> = {
            productAdministrator: false,
            interactionManager: false,
            campaignManager: false,
            purchaseOracleUpdater: false,
        };
        for (const [role, value] of Object.entries(productRoles)) {
            rolesMap[role as ProductRolesKey] = (rolesMask & value) === value;
        }
        return rolesMap;
    };

    // Return that mapped with the right types
    const administrators = json.map((result) => ({
        wallet: result.wallet,
        isOwner: result.isOwner,
        roles: toHex(BigInt(result.roles)),
        addedTimestamp: BigInt(result.addedTimestamp),
        roleDetails: {
            admin: result.isOwner,
            ...buildRolesMap(BigInt(result.roles)),
        } as Record<"admin" | ProductRolesKey, boolean>,
    }));

    // Filter out the people when they are only the purchaseOracleUpdater
    return administrators.filter((admin) => {
        return !admin.roleDetails.purchaseOracleUpdater;
    });
}
