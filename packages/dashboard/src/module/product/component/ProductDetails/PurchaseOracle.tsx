import { viemClient } from "@/context/blockchain/provider";
import { purcheOracleUpdaterRoles } from "@/context/blockchain/roles";
import { Badge } from "@/module/common/component/Badge";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { FormLabel } from "@/module/forms/Form";
import {
    addresses,
    productAdministratorRegistryAbi,
} from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { backendApi } from "@frak-labs/shared/context/server";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { Spinner } from "@module/component/Spinner";
import { Input } from "@module/component/forms/Input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { readContract } from "viem/actions";
import { useProductMetadata } from "../../hook/useProductMetadata";
import styles from "./PurchaseOracle.module.css";

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
        <PanelAccordion
            title="Purchase Tracker"
            className={styles.purchaseOracleSetup}
        >
            <p className={styles.purchaseOracleSetup__description}>
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
    const { data: oracleSetupData, refetch: refresh } = useQuery({
        queryKey: ["product", "oracle-setup-data"],
        queryFn: async () => {
            // Get the oracle updater address
            const { data: oracleUpdater } =
                await backendApi.common.adminWallet.get({
                    query: {
                        key: "oracle-updater",
                    },
                });
            if (!oracleUpdater?.pubKey) {
                return null;
            }

            // Get the current backend setup status
            const { data: webhookStatus } = await backendApi.business
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
                oracleUpdater: oracleUpdater.pubKey,
                isOracleUpdaterAllowed,
                isWebhookSetup: webhookStatus?.setup,
                webhookUrl: `${process.env.BACKEND_URL}/business/oracle/shopify/${productId}/hook`,
                webhookStatus,
            };
        },
    });

    if (!oracleSetupData) {
        return <Spinner />;
    }

    return (
        <>
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
                            productId={productId}
                            refresh={refresh}
                        />
                    </p>
                </Column>
            </Columns>
            <Columns>
                <Column size={"full"}>
                    <Title as={"h3"}>Webhook status</Title>
                    <p>
                        <Badge
                            variant={
                                oracleSetupData.isWebhookSetup
                                    ? "success"
                                    : "warning"
                            }
                        >
                            {oracleSetupData.isWebhookSetup
                                ? "Webhook registered on Frak"
                                : "Webhook not registered on Frak"}
                        </Badge>
                    </p>

                    <p>
                        Webhook URL to use in your shopify notification centers:{" "}
                    </p>
                    <pre>{oracleSetupData.webhookUrl}</pre>
                </Column>
            </Columns>
            <Columns>
                <Column size={"full"}>
                    <Title as={"h3"}>Webhook registration</Title>
                    <WebhookRegistrationForm
                        productId={productId}
                        currentSigninKey={
                            oracleSetupData.webhookStatus?.setup
                                ? oracleSetupData.webhookStatus.webhookSigninKey
                                : undefined
                        }
                        refresh={refresh}
                    />
                </Column>
            </Columns>

            <WebhookStats stats={oracleSetupData.webhookStatus} />
        </>
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
 *  todo: Should only be possible for product admin
 *  todo: review contract to also allow product manager?
 */
function ToggleOracleUpdaterRole({
    productId,
    oracleUpdater,
    isOracleUpdaterAllowed,
    refresh,
}: {
    productId: Hex;
    oracleUpdater: Address;
    isOracleUpdaterAllowed: boolean;
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
                                    purcheOracleUpdaterRoles,
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
                                purcheOracleUpdaterRoles,
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

function WebhookRegistrationForm({
    productId,
    currentSigninKey,
    refresh,
}: {
    productId: Hex;
    currentSigninKey?: string;
    refresh: () => Promise<unknown>;
}) {
    const { mutate: setupWebhook, isPending } = useMutation({
        mutationKey: ["product", "oracle-webhook", "setup"],
        mutationFn: async ({ webhookKey }: { webhookKey: string }) => {
            await backendApi.business
                .oracle({ productId })
                .setup.post({ hookSignatureKey: webhookKey });
        },
        onSettled: async () => {
            await refresh();
        },
    });

    const [key, setKey] = useState(currentSigninKey ?? "");
    const [error, setError] = useState<string | undefined>();

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                setError(undefined);
                if (key === "") {
                    setError("Missing signin key");
                    return;
                }
                setupWebhook({ webhookKey: key });
            }}
        >
            <FormLabel weight={"medium"} htmlFor={"webhook-signin-key"}>
                The webhook signin key from your shopify admin panel
            </FormLabel>
            <Input
                id={"webhook-signin-key"}
                length={"medium"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={isPending}
                placeholder="Webhook signin key"
            />
            {error && <p className={"error"}>{error}</p>}
            <Button type="submit" variant="information" disabled={isPending}>
                {currentSigninKey ? "Setup webhook" : "Register webhook"}
            </Button>
        </form>
    );
}
