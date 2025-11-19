import { type ProductRolesKey, productRoles } from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/client/server";
import { useQuery } from "@tanstack/react-query";
import { type Address, type Hex, toHex } from "viem";
import { useAuthStore } from "@/stores/authStore";

/**
 * Mock administrators data for demo mode
 */
const MOCK_ADMINISTRATORS = [
    {
        wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" as Address,
        isOwner: true,
        roles: "0x0" as Hex,
        addedTimestamp: BigInt(1704067200),
        roleDetails: {
            admin: true,
            productAdministrator: false,
            interactionManager: false,
            campaignManager: false,
            purchaseOracleUpdater: false,
        },
        isMe: false,
    },
    {
        wallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199" as Address,
        isOwner: false,
        roles: "0x03" as Hex,
        addedTimestamp: BigInt(1705276800),
        roleDetails: {
            admin: false,
            productAdministrator: true,
            interactionManager: false,
            campaignManager: true,
            purchaseOracleUpdater: false,
        },
        isMe: false,
    },
    {
        wallet: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1" as Address,
        isOwner: false,
        roles: "0x04" as Hex,
        addedTimestamp: BigInt(1706486400),
        roleDetails: {
            admin: false,
            productAdministrator: false,
            interactionManager: true,
            campaignManager: false,
            purchaseOracleUpdater: false,
        },
        isMe: false,
    },
];

export type ProductAdministrator = {
    wallet: Address;
    isOwner: boolean;
    roles: Hex;
    addedTimestamp: bigint;
    roleDetails: Record<"admin" | ProductRolesKey, boolean>;
    isMe: boolean;
};

type ApiResult = {
    wallet: Address;
    isOwner: boolean;
    roles: string; // bigint
    addedTimestamp: string; // bigint
}[];

/**
 * Hook to get product administrators with demo mode support
 */
export function useGetProductAdministrators({ productId }: { productId: Hex }) {
    const isDemoMode = useAuthStore((state) => state.token === "demo-token");

    return useQuery({
        queryKey: ["product", "team", productId, isDemoMode ? "demo" : "live"],
        queryFn: async () => {
            // Return mock data in demo mode
            if (isDemoMode) {
                // Simulate network delay
                await new Promise((resolve) => setTimeout(resolve, 200));
                return MOCK_ADMINISTRATORS;
            }

            // Fetch from indexer API
            const json = await indexerApi
                .get(`products/${productId}/administrators`)
                .json<ApiResult>();

            // Parse the roles
            const buildRolesMap = (rolesMask: bigint) => {
                const rolesMap: Record<ProductRolesKey, boolean> = {
                    productAdministrator: false,
                    interactionManager: false,
                    campaignManager: false,
                    purchaseOracleUpdater: false,
                };
                for (const [role, value] of Object.entries(productRoles)) {
                    rolesMap[role as ProductRolesKey] =
                        (rolesMask & value) === value;
                }
                return rolesMap;
            };

            // Return mapped with the right types
            const administrators = json.map((result) => ({
                wallet: result.wallet,
                isOwner: result.isOwner,
                roles: toHex(BigInt(result.roles)),
                addedTimestamp: BigInt(result.addedTimestamp),
                roleDetails: {
                    admin: result.isOwner,
                    ...buildRolesMap(BigInt(result.roles)),
                } as Record<"admin" | ProductRolesKey, boolean>,
                isMe: false, // Will be updated by component if needed
            }));

            // Filter out people who are only purchaseOracleUpdater
            return administrators.filter((admin) => {
                return !admin.roleDetails.purchaseOracleUpdater;
            });
        },
        enabled: !!productId,
    });
}
