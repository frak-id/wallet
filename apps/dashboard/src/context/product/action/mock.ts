"use server";

import type { Hex } from "viem";
import productsData from "@/mock/products.json";

type GetProductResult = {
    owner: { id: Hex; name: string; domain: string }[];
    operator: { id: Hex; name: string; domain: string }[];
};

/**
 * Mock implementation of getMyProducts for demo mode
 * Returns mock product data with a realistic delay
 */
export async function getMyProductsMock(): Promise<GetProductResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Return the mock data with proper typing
    return productsData as GetProductResult;
}

/**
 * Mock implementation of getAdministrators for demo mode
 * Returns mock administrators data with the same structure as the real function
 */
export async function getAdministratorsMock() {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Return mock administrators with full structure matching getProductAdministrators
    return [
        {
            wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as const,
            isOwner: true,
            roles: "0x0",
            addedTimestamp: BigInt(1704067200),
            roleDetails: {
                admin: true,
                productAdministrator: false,
                interactionManager: false,
                campaignManager: false,
                purchaseOracleUpdater: false,
            },
        },
        {
            wallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199" as const,
            isOwner: false,
            roles: "0x03",
            addedTimestamp: BigInt(1705276800),
            roleDetails: {
                admin: false,
                productAdministrator: true,
                interactionManager: false,
                campaignManager: true,
                purchaseOracleUpdater: false,
            },
        },
        {
            wallet: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1" as const,
            isOwner: false,
            roles: "0x04",
            addedTimestamp: BigInt(1706486400),
            roleDetails: {
                admin: false,
                productAdministrator: false,
                interactionManager: true,
                campaignManager: false,
                purchaseOracleUpdater: false,
            },
        },
    ];
}
