import {
    addresses,
    productAdministratorRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { viemClient } from "@/context/blockchain/provider";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useGetAdminWallet } from "@/module/common/hook/useGetAdminWallet";

export function useOracleSetupData({
    merchantId,
    productId,
}: {
    merchantId: string;
    productId?: Hex;
}) {
    const isDemoMode = useIsDemoMode();
    const { data: oracleUpdater } = useGetAdminWallet({
        key: "oracle-updater",
    });

    return useQuery({
        enabled: !!oracleUpdater && !!merchantId,
        queryKey: [
            "merchant",
            merchantId,
            "oracle-setup-data",
            productId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async () => {
            if (!oracleUpdater) {
                return null;
            }

            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return {
                    oracleUpdater,
                    isOracleUpdaterAllowed: true,
                    isWebhookSetup: true,
                    webhookStatus: {
                        setup: true as const,
                        platform: "custom" as const,
                        webhookSigninKey: "demo-signing-key-xxxx",
                        stats: {
                            totalPurchaseHandled: 42,
                        },
                    },
                };
            }

            const { data: webhookStatus } = await authenticatedBackendApi
                .merchant({ merchantId })
                .webhooks.get();

            let isOracleUpdaterAllowed = false;
            if (productId) {
                isOracleUpdaterAllowed = await readContract(viemClient, {
                    abi: productAdministratorRegistryAbi,
                    address: addresses.productAdministratorRegistry,
                    functionName: "hasAllRolesOrOwner",
                    args: [
                        BigInt(productId),
                        oracleUpdater,
                        productRoles.purchaseOracleUpdater,
                    ],
                });
            }

            return {
                oracleUpdater: oracleUpdater,
                isOracleUpdaterAllowed,
                isWebhookSetup: webhookStatus?.setup,
                webhookStatus,
            };
        },
    });
}
