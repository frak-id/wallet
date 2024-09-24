import { viemClient } from "@/context/blockchain/provider";
import { purcheOracleUpdaterRoles } from "@/context/blockchain/roles";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import {
    addresses,
    productAdministratorRegistryAbi,
} from "@frak-labs/app-essentials";
import { backendApi } from "@frak-labs/shared/context/server";
import { Spinner } from "@module/component/Spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { readContract } from "viem/actions";
import { useProductMetadata } from "../../hook/useProductMetadata";

/**
 * Setup data for the purchase oracle
 */
export function PurchaseOracleSetup({ productId }: { productId: Hex }) {
    const { data: product } = useProductMetadata({ productId });

    // Early exit if the product is not a purchase
    if (!product?.productTypes.includes("purchase")) {
        return null;
    }

    return (
        <PanelAccordion title="Purchase Tracker">
            <p>
                The purchase tracker will permit to create campaigns and
                distribute rewards based on user purchase on your website.
            </p>
            <ProductOracleSetupInner productId={productId} />
        </PanelAccordion>
    );
}

/**
 *
 * @param param0
 * @returns
 */
function ProductOracleSetupInner({ productId }: { productId: Hex }) {
    // Fetch some data about the current oracle setup
    const { data: oracleSetupData } = useQuery({
        queryKey: ["product", "oracle-setup-data"],
        queryFn: async () => {
            // Get the oracle updater address
            const { data: oracleUpdater } =
                await backendApi.interactions.validatorPublicKey.get({
                    query: {
                        key: "oracle-updater",
                    },
                });
            if (!oracleUpdater) {
                return null;
            }

            // Get the current backend setup status
            const { data: backendStatus } = await backendApi.business
                .oracle({ productId })
                .status.get();

            // Check if the updater is allowed on this product
            const isOracleUpdaterAllowed = await readContract(viemClient, {
                abi: productAdministratorRegistryAbi,
                address: addresses.productAdministratorRegistry,
                functionName: "hasAllRolesOrAdmin",
                args: [
                    BigInt(productId),
                    oracleUpdater.pubKey,
                    purcheOracleUpdaterRoles,
                ],
            });

            return {
                oracleUpdater,
                isOracleUpdaterAllowed,
                isWebhookSetup: backendStatus === "ok",
                webhookUrl: `${process.env.BACKEND_URL}/business/oracle/shopify/${productId}/hook`,
            };
        },
    });

    // Setup the oracle on the backend side
    useMutation({
        mutationKey: ["product", "oracle", "setup"],
        mutationFn: async ({ webhookKey }: { webhookKey: string }) => {
            await backendApi.business
                .oracle({ productId })
                .setup.post({ hookSignatureKey: webhookKey });
        },
    });

    if (!oracleSetupData) {
        return <Spinner />;
    }

    return (
        <div>
            <p>Oracle updater: {oracleSetupData.oracleUpdater.pubKey}</p>
            <p>
                Oracle updater allowed:{" "}
                {oracleSetupData.isOracleUpdaterAllowed ? "yes" : "no"}
            </p>
            <p>
                Webhook setup: {oracleSetupData.isWebhookSetup ? "yes" : "no"}
            </p>
            <p>Webhook URL: {oracleSetupData.webhookUrl}</p>
        </div>
    );
}
