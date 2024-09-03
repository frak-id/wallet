import { viemClient } from "@/context/blockchain/provider";
import { roles } from "@/context/blockchain/roles";
import { getManagedValidatorPublicKey } from "@/context/product/action/getValidator";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import {
    productInteractionDiamondAbi,
    productInteractionManagerAbi,
} from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { productAdministratorRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Button } from "@module/component/Button";
import { Spinner } from "@module/component/Spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { tryit } from "radash";
import { type Address, encodeFunctionData, toHex } from "viem";
import { readContract } from "viem/actions";

/**
 * Component to manage the interaction settings
 * @constructor
 */
export function InteractionSettings({ productId }: { productId: bigint }) {
    const { data: walletStatus } = useWalletStatus();
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const {
        data: detailsData,
        isLoading: isFetchingInteractionContract,
        refetch: refreshDetails,
    } = useQuery({
        enabled: !!productId,
        queryKey: [
            "product",
            "details",
            walletStatus?.key,
            productId.toString(),
        ],
        queryFn: async () => {
            if (walletStatus?.key !== "connected") {
                return null;
            }

            // Check if the user is allowed on the product
            const isAllowed = await readContract(viemClient, {
                abi: productAdministratorRegistryAbi,
                functionName: "hasAllRolesOrAdmin",
                address: addresses.productAdministratorRegistry,
                args: [productId, walletStatus.wallet, roles.productManager],
            });

            // Fetch the on chain interaction contract
            const [, interactionContract] = await tryit(() =>
                readContract(viemClient, {
                    abi: productInteractionManagerAbi,
                    functionName: "getInteractionContract",
                    address: addresses.productInteractionManager,
                    args: [productId],
                })
            )();

            return {
                isAllowed,
                interactionContract,
            };
        },
    });

    const { mutate: deployInteraction } = useMutation({
        mutationKey: ["product", "deploy-interaction"],
        mutationFn: async () => {
            await sendTransaction({
                tx: {
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deployInteractionContract",
                        args: [productId],
                    }),
                },
                metadata: {
                    header: {
                        title: "Deploy interaction handler",
                    },
                },
            });
            await refreshDetails();
        },
    });

    const { mutate: deleteInteraction } = useMutation({
        mutationKey: ["product", "delete-interaction"],
        mutationFn: async () => {
            await sendTransaction({
                tx: {
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deleteInteractionContract",
                        args: [productId],
                    }),
                },
                metadata: {
                    header: {
                        title: "Remove interaction handler",
                    },
                },
            });
            await refreshDetails();
        },
    });

    if (isFetchingInteractionContract) {
        return (
            <Panel title={"Interaction Settings"}>
                <Spinner />
            </Panel>
        );
    }

    return (
        <Panel title={"Interaction Settings"}>
            <>
                <div>
                    <h3>Interaction Contract</h3>
                    <p>
                        <strong>Status: </strong>{" "}
                        {detailsData?.interactionContract ? (
                            <Badge variant={"success"}>Deployed</Badge>
                        ) : (
                            <Badge variant={"warning"}>Not Deployed</Badge>
                        )}
                    </p>

                    {detailsData?.interactionContract && (
                        <p>
                            <strong>Address: </strong>{" "}
                            <pre>{detailsData.interactionContract}</pre>
                        </p>
                    )}

                    {detailsData?.interactionContract &&
                        detailsData?.isAllowed && (
                            <Button
                                variant={"submit"}
                                onClick={() => deleteInteraction()}
                            >
                                Delete contract
                            </Button>
                        )}

                    {!detailsData?.interactionContract &&
                        detailsData?.isAllowed && (
                            <Button
                                variant={"submit"}
                                onClick={() => deployInteraction()}
                            >
                                Deploy contract
                            </Button>
                        )}

                    <p>
                        <strong>Info:</strong> The Interaction Contract receives
                        user interactions and triggers campaigns after
                        validation.
                        <br />
                        It's essential for enabling blockchain-based user
                        engagement with your product.
                    </p>
                </div>
                <hr />
                {detailsData?.interactionContract && (
                    <ManagedInteractionValidator
                        productId={productId}
                        interactionContract={detailsData.interactionContract}
                    />
                )}
                <hr />
                <p>
                    For more information on using the Managed Interaction
                    Validator with the SDK, see our{" "}
                    <Link
                        href={
                            "https://docs.frak.id/wallet-sdk/api/react/hooks/useWalletStatus"
                        }
                    >
                        documentation
                    </Link>
                    .
                </p>
            </>
        </Panel>
    );
}

function ManagedInteractionValidator({
    productId,
    interactionContract,
}: { productId: bigint; interactionContract: Address }) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const { data, isLoading, refetch } = useQuery({
        queryKey: [
            "product",
            "managed-interaction-validator",
            interactionContract,
            productId.toString(),
        ],
        queryFn: async () => {
            const validatorPublicKey = await getManagedValidatorPublicKey({
                productId: toHex(productId),
            });
            if (!validatorPublicKey) {
                return null;
            }
            const hasValidatorRoles = await readContract(viemClient, {
                abi: productInteractionDiamondAbi,
                address: interactionContract,
                functionName: "hasAllRoles",
                args: [validatorPublicKey, roles.interactionValidatorRoles],
            });
            return { validatorPublicKey, hasValidatorRoles };
        },
    });

    const { mutate: changeValidatorAllowance } = useMutation({
        mutationKey: [
            "product",
            "managed-interaction-validator",
            "update-permissions",
        ],
        mutationFn: async ({ allow }: { allow: boolean }) => {
            if (!data?.validatorPublicKey) {
                return;
            }

            await sendTransaction({
                tx: {
                    to: interactionContract,
                    data: encodeFunctionData({
                        abi: productInteractionDiamondAbi,
                        functionName: allow ? "grantRoles" : "revokeRoles",
                        args: [
                            data.validatorPublicKey,
                            roles.interactionValidatorRoles,
                        ],
                    }),
                },
                metadata: {
                    header: {
                        title: "Update managed validator",
                    },
                },
            });

            await refetch();
        },
    });

    if (isLoading || !data) {
        return (
            <div>
                <h3>Managed Interaction Validator</h3>
                <Spinner />
            </div>
        );
    }

    return (
        <div>
            <h3>Managed Interaction Validator</h3>
            <p>
                <strong>Status: </strong>{" "}
                {data.hasValidatorRoles ? (
                    <Badge variant={"success"}>Allowed</Badge>
                ) : (
                    <Badge variant={"warning"}>Not Allowed</Badge>
                )}
            </p>

            {data.validatorPublicKey && (
                <p>
                    <strong>Public Key: </strong>{" "}
                    <pre>{data.validatorPublicKey}</pre>
                </p>
            )}

            {data.hasValidatorRoles ? (
                <Button
                    variant={"submit"}
                    onClick={() => changeValidatorAllowance({ allow: false })}
                >
                    Revoke permissions
                </Button>
            ) : (
                <Button
                    variant={"submit"}
                    onClick={() => changeValidatorAllowance({ allow: true })}
                >
                    Grant permissions
                </Button>
            )}

            <p>
                <strong>Info:</strong> The Managed Interaction Validator
                simplifies Nexus SDK integration by handling interaction
                validation.
                <br /> When allowed, you can submit user interactions without
                generating ECDSA signatures.
            </p>
        </div>
    );
}
