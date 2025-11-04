import {
    addresses,
    productAdministratorRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { businessApi } from "@frak-labs/client/server";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";
import { useGetAdminWallet } from "@/module/common/hook/useGetAdminWallet";

/**
 * Hook to fetch the oracle setup data
 */
export function useOracleSetupData({ productId }: { productId: Hex }) {
    const { data: oracleUpdater } = useGetAdminWallet({
        key: "oracle-updater",
    });
    // Fetch some data about the current oracle setup
    return useQuery({
        enabled: !!oracleUpdater,
        queryKey: ["product", "oracle-setup-data", productId],
        queryFn: async () => {
            if (!oracleUpdater) {
                return null;
            }

            // Get the current backend setup status
            const { data: webhookStatus } = await businessApi
                .product({ productId })
                .oracleWebhook.status.get();

            // Check if the updater is allowed on this product
            const isOracleUpdaterAllowed = await readContract(viemClient, {
                abi: productAdministratorRegistryAbi,
                address: addresses.productAdministratorRegistry,
                functionName: "hasAllRolesOrOwner",
                args: [
                    BigInt(productId),
                    oracleUpdater,
                    productRoles.purchaseOracleUpdater,
                ],
            });

            return {
                oracleUpdater: oracleUpdater,
                isOracleUpdaterAllowed,
                isWebhookSetup: webhookStatus?.setup,
                webhookStatus,
            };
        },
    });
}
