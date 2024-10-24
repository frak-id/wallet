import { viemClient } from "@/context/blockchain/provider";
import { Badge } from "@/module/common/component/Badge";
import { CallOut } from "@/module/common/component/CallOut";
import { Panel } from "@/module/common/component/Panel";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { useHasRoleOnProduct } from "@/module/common/hook/useHasRoleOnProduct";
import { useSetupInteractionContract } from "@/module/product/hook/useSetupInteractionContract";
import {
    addresses,
    interactionValidatorRoles,
    productInteractionDiamondAbi,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import { AlertDialog } from "@module/component/AlertDialog";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { WalletAddress } from "@module/component/HashDisplay";
import { Spinner } from "@module/component/Spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { all, tryit } from "radash";
import { useState } from "react";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { readContract } from "viem/actions";
import styles from "./InteractionSettings.module.css";

/**
 * Component to manage the interaction settings
 * @constructor
 */
export function InteractionSettings({ productId }: { productId: Hex }) {
    const { rolesReady, isInteractionManager } = useHasRoleOnProduct({
        productId,
    });
    const { mutateAsync: setupInteractionContract } =
        useSetupInteractionContract();

    const {
        data: detailsData,
        isLoading: isFetchingInteractionContract,
        refetch: refreshDetails,
    } = useQuery({
        enabled: !!productId && rolesReady,
        queryKey: ["product", "interaction-details", productId.toString()],
        queryFn: async () => {
            // Fetch the on chain interaction contract
            const [, interactionContract] = await tryit(() =>
                readContract(viemClient, {
                    abi: productInteractionManagerAbi,
                    functionName: "getInteractionContract",
                    address: addresses.productInteractionManager,
                    args: [BigInt(productId)],
                })
            )();

            return {
                interactionContract,
            };
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
        <PanelAccordion
            title={"Interaction Settings"}
            className={styles.interactionSettings}
        >
            <>
                <Columns>
                    <Column size={"full"}>
                        <Title as={"h3"}>Interaction Contract</Title>
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
                                <WalletAddress
                                    wallet={detailsData.interactionContract}
                                />
                            </p>
                        )}

                        {detailsData?.interactionContract &&
                            isInteractionManager && (
                                <ModalDelete
                                    productId={productId}
                                    refreshDetails={async () => {
                                        await refreshDetails();
                                    }}
                                />
                            )}

                        {!detailsData?.interactionContract &&
                            isInteractionManager && (
                                <Button
                                    variant={"submit"}
                                    onClick={() =>
                                        setupInteractionContract({
                                            productId,
                                            salt: generatePrivateKey(),
                                        })
                                    }
                                    className={
                                        styles.interactionSettings__button
                                    }
                                >
                                    Deploy contract
                                </Button>
                            )}

                        <CallOut variant={"secondary"}>
                            The Interaction Contract receives user interactions
                            and triggers campaigns after validation.
                            <br />
                            It's essential for enabling blockchain-based user
                            engagement with your product.
                        </CallOut>
                    </Column>
                </Columns>

                <Columns>
                    <Column size={"full"}>
                        {detailsData?.interactionContract && (
                            <ManagedInteractionValidator
                                productId={productId}
                                interactionContract={
                                    detailsData.interactionContract
                                }
                            />
                        )}
                        <CallOut variant={"secondary"}>
                            For more information on using the Managed
                            Interaction Validator with the SDK, see our{" "}
                            <Link
                                href={
                                    "https://docs.frak.id/wallet-sdk/api/react/hooks/useWalletStatus"
                                }
                            >
                                documentation
                            </Link>
                            .
                        </CallOut>
                    </Column>
                </Columns>
            </>
        </PanelAccordion>
    );
}

function ManagedInteractionValidator({
    productId,
    interactionContract,
}: { productId: Hex; interactionContract: Address }) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const { data, isLoading, refetch } = useQuery({
        queryKey: [
            "product",
            "managed-interaction-validator",
            interactionContract,
            productId,
        ],
        queryFn: async () => {
            const { productResult, interactionExecutorResult } = await all({
                productResult: backendApi.common.adminWallet.get({
                    query: { productId },
                }),
                interactionExecutorResult: backendApi.common.adminWallet.get({
                    query: { key: "interaction-executor" },
                }),
            });

            if (!productResult?.data?.pubKey) {
                return null;
            }
            const validatorPublicKey = productResult.data.pubKey;
            const hasValidatorRoles = await readContract(viemClient, {
                abi: productInteractionDiamondAbi,
                address: interactionContract,
                functionName: "hasAllRoles",
                args: [validatorPublicKey, interactionValidatorRoles],
            });
            return {
                validatorPublicKey,
                interactionExecutorPubKey:
                    interactionExecutorResult?.data?.pubKey,
                hasValidatorRoles,
            };
        },
    });

    const {
        mutateAsync: changeValidatorAllowance,
        isPending: isPendingChangeValidatorAllowance,
        isError: isErrorChangeValidatorAllowance,
    } = useMutation({
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
                            interactionValidatorRoles,
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
        <>
            <Title as={"h3"}>Managed Interaction Validator</Title>

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
                    <WalletAddress wallet={data.validatorPublicKey} />
                </p>
            )}

            {data.hasValidatorRoles ? (
                <ModalRevokePermissions
                    changeValidatorAllowance={async () => {
                        await changeValidatorAllowance({ allow: false });
                    }}
                    isRevoking={isPendingChangeValidatorAllowance}
                    isError={isErrorChangeValidatorAllowance}
                />
            ) : (
                <Button
                    variant={"submit"}
                    onClick={() => changeValidatorAllowance({ allow: true })}
                    className={styles.interactionSettings__button}
                >
                    Grant permissions
                </Button>
            )}

            <CallOut variant={"secondary"}>
                The Managed Interaction Validator simplifies Frak Wallet SDK
                integration by handling interaction validation.
                <br /> When allowed, you can submit user interactions without
                generating ECDSA signatures.
            </CallOut>

            {data.interactionExecutorPubKey && (
                <p>
                    <strong>Interaction executor: </strong>{" "}
                    <WalletAddress wallet={data.interactionExecutorPubKey} />
                </p>
            )}
        </>
    );
}

/**
 * Component representing the delete modal for the interaction contract
 * @param productId
 * @param refreshDetails
 * @constructor
 */
function ModalDelete({
    productId,
    refreshDetails,
}: { productId: Hex; refreshDetails: () => Promise<void> }) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const [open, setOpen] = useState(false);

    const {
        mutateAsync: deleteInteraction,
        isPending: isDeleting,
        isError,
    } = useMutation({
        mutationKey: ["product", "delete-interaction"],
        mutationFn: async () => {
            await sendTransaction({
                tx: {
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deleteInteractionContract",
                        args: [BigInt(productId)],
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

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Delete contract"}
            buttonElement={
                <Button
                    variant={"danger"}
                    className={styles.interactionSettings__button}
                >
                    Delete contract
                </Button>
            }
            description={<>Are you sure you want to delete the contract?</>}
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"danger"}
                    isLoading={isDeleting}
                    disabled={isDeleting}
                    onClick={async () => {
                        await deleteInteraction();
                        setOpen(false);
                    }}
                >
                    Delete
                </Button>
            }
        />
    );
}

/**
 * Component representing the revoking modal for the interaction contract
 * @param changeValidatorAllowance
 * @param isRevoking
 * @param isError
 * @constructor
 */
function ModalRevokePermissions({
    changeValidatorAllowance,
    isRevoking,
    isError,
}: {
    changeValidatorAllowance: () => Promise<void>;
    isRevoking: boolean;
    isError?: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Revoke permissions"}
            buttonElement={
                <Button
                    variant={"danger"}
                    className={styles.interactionSettings__button}
                >
                    Revoke permissions
                </Button>
            }
            description={<>Are you sure you want to revoke permissions?</>}
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"danger"}
                    isLoading={isRevoking}
                    disabled={isRevoking}
                    onClick={async () => {
                        await changeValidatorAllowance();
                        setOpen(false);
                    }}
                >
                    Delete
                </Button>
            }
        />
    );
}
