import { Badge } from "@/module/common/component/Badge";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { useHasRoleOnProduct } from "@/module/common/hook/useHasRoleOnProduct";
import {
    addresses,
    productAdministratorRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { Spinner } from "@module/component/Spinner";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { useOracleSetupData } from "../../hook/useOracleSetupData";
import { useProductMetadata } from "../../hook/useProductMetadata";
import styles from "./PurchaseTracker.module.css";
import { PurchaseTrackerWebhook } from "./PurchaseTrackerWebhook";

/**
 * Setup data for the purchase oracle
 */
export function PurchasseTrackerSetup({ productId }: { productId: Hex }) {
    const { data: product } = useProductMetadata({ productId });

    // Early exit if the product is not a purchase
    if (!product?.productTypes.includes("purchase")) {
        return null;
    }

    return (
        <PanelAccordion
            title="Purchase Tracker"
            id={"purchaseTracker"}
            className={styles.purchaseOracleSetup}
        >
            <p className={styles.purchaseTracker__description}>
                The purchase tracker will permit to create campaigns and
                distribute rewards based on user purchase on your website.
            </p>
            <PurchasseTrackerAccordionContent productId={productId} />
        </PanelAccordion>
    );
}

/**
 * The content of the accordion
 */
function PurchasseTrackerAccordionContent({ productId }: { productId: Hex }) {
    const { isAdministrator } = useHasRoleOnProduct({ productId });
    // Fetch some data about the current oracle setup
    const { data: oracleSetupData, refetch: refresh } = useOracleSetupData({
        productId,
    });

    if (!oracleSetupData) {
        return <Spinner />;
    }

    return (
        <div className={styles.purchaseTrackerAccordionContent}>
            <PurchaseTrackerWebhook productId={productId} />
            <Columns>
                <Column size={"full"}>
                    <Title as={"h3"}>Oracle</Title>
                    <p>
                        <Badge
                            variant={
                                oracleSetupData.isOracleUpdaterAllowed
                                    ? "success"
                                    : "warning"
                            }
                        >
                            {oracleSetupData.isOracleUpdaterAllowed
                                ? "Allowed"
                                : "Disallowed"}
                        </Badge>
                    </p>

                    <p>
                        <ToggleOracleUpdaterRole
                            {...oracleSetupData}
                            disabled={!isAdministrator}
                            productId={productId}
                            refresh={refresh}
                        />
                    </p>
                </Column>
            </Columns>
            <WebhookStats stats={oracleSetupData.webhookStatus} />
        </div>
    );
}

/**
 * Some webhook stats
 */
function WebhookStats({
    stats,
}: {
    stats?:
        | { setup: false }
        | {
              setup: true;
              webhookSigninKey: string;
              stats?: {
                  firstPurchase?: Date;
                  lastPurchase?: Date;
                  lastUpdate?: Date;
                  totalPurchaseHandled?: number;
              };
          }
        | null;
}) {
    if (!stats?.setup) {
        return null;
    }

    if (!stats.stats) {
        return (
            <>
                <h3>Stats</h3>
                <p>No stats currently available</p>
            </>
        );
    }

    return (
        <Columns>
            <Column size={"full"}>
                <Title as={"h3"}>Stats</Title>
                <p>
                    First purchase:{" "}
                    {stats.stats.firstPurchase?.toString() ?? "N/A"}
                </p>
                <p>
                    Last purchase:{" "}
                    {stats.stats.lastPurchase?.toString() ?? "N/A"}
                </p>
                <p>
                    Last update: {stats.stats.lastUpdate?.toString() ?? "N/A"}
                </p>
                <p>
                    Total purchase handled:{" "}
                    {stats.stats?.totalPurchaseHandled ?? "N/A"}
                </p>
            </Column>
        </Columns>
    );
}

/**
 * Toggle the oracle updater role
 */
function ToggleOracleUpdaterRole({
    productId,
    oracleUpdater,
    isOracleUpdaterAllowed,
    disabled,
    refresh,
}: {
    productId: Hex;
    oracleUpdater: Address;
    isOracleUpdaterAllowed: boolean;
    disabled?: boolean;
    refresh: () => Promise<unknown>;
}) {
    const { mutate: sendTx } = useSendTransactionAction({
        mutations: {
            onSuccess: async () => {
                await refresh();
            },
        },
    });

    if (isOracleUpdaterAllowed) {
        return (
            <Button
                variant={"danger"}
                disabled={disabled}
                onClick={() =>
                    sendTx({
                        tx: {
                            to: addresses.productAdministratorRegistry,
                            data: encodeFunctionData({
                                abi: productAdministratorRegistryAbi,
                                functionName: "revokeRoles",
                                args: [
                                    BigInt(productId),
                                    oracleUpdater,
                                    productRoles.purchaseOracleUpdater,
                                ],
                            }),
                        },
                    })
                }
            >
                Disallow oracle updater
            </Button>
        );
    }

    return (
        <Button
            variant={"submit"}
            onClick={() =>
                sendTx({
                    tx: {
                        to: addresses.productAdministratorRegistry,
                        data: encodeFunctionData({
                            abi: productAdministratorRegistryAbi,
                            functionName: "grantRoles",
                            args: [
                                BigInt(productId),
                                oracleUpdater,
                                productRoles.purchaseOracleUpdater,
                            ],
                        }),
                    },
                })
            }
        >
            Allow oracle updater
        </Button>
    );
}
