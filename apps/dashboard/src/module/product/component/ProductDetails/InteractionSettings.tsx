import {
    addresses,
    interactionValidatorRoles,
    productInteractionDiamondAbi,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { AlertDialog } from "@frak-labs/ui/component/AlertDialog";
import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { WalletAddress } from "@frak-labs/ui/component/HashDisplay";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { readContract } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";
import { Badge } from "@/module/common/component/Badge";
import { CallOut } from "@/module/common/component/CallOut";
import { Panel } from "@/module/common/component/Panel";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { Title } from "@/module/common/component/Title";
import { useGetAdminWallet } from "@/module/common/hook/useGetAdminWallet";
import { useHasRoleOnProduct } from "@/module/common/hook/useHasRoleOnProduct";
import { useProductInteractionContract } from "@/module/product/hook/useProductInteractionContract";
import { useSetupInteractionContract } from "@/module/product/hook/useSetupInteractionContract";
import styles from "./InteractionSettings.module.css";

/**
 * Component to manage the interaction settings
 * @constructor
 */
export function InteractionSettings({ productId }: { productId: Hex }) {
    const { isInteractionManager } = useHasRoleOnProduct({
        productId,
    });
    const { mutateAsync: setupInteractionContract } =
        useSetupInteractionContract();

    const {
        data: detailsData,
        isLoading: isFetchingInteractionContract,
        refetch: refreshDetails,
    } = useProductInteractionContract({ productId });

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
            id={"interactionSettings"}
            className={styles.interactionSettings}
        >
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
                                className={styles.interactionSettings__button}
                            >
                                Deploy contract
                            </Button>
                        )}

                    <CallOut variant={"secondary"}>
                        The Interaction Contract receives user interactions and
                        triggers campaigns after validation.
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
                    </CallOut>
                </Column>
            </Columns>
        </PanelAccordion>
    );
}

function ManagedInteractionValidator({
    productId,
    interactionContract,
}: {
    productId: Hex;
    interactionContract: Address;
}) {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const { data: productValidator } = useGetAdminWallet({ productId });
    const { data: interactionExecutor } = useGetAdminWallet({
        key: "interaction-executor",
    });

    const { data, isLoading, refetch } = useQuery({
        enabled: !!productValidator,
        queryKey: [
            "product",
            "managed-interaction-validator",
            interactionContract,
            productId,
        ],
        queryFn: async () => {
            if (!productValidator) {
                return null;
            }
            const hasValidatorRoles = await readContract(viemClient, {
                abi: productInteractionDiamondAbi,
                address: interactionContract,
                functionName: "hasAllRoles",
                args: [productValidator, interactionValidatorRoles],
            });
            return {
                productValidator,
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
            if (!productValidator) {
                return;
            }

            await sendTransaction({
                tx: {
                    to: interactionContract,
                    data: encodeFunctionData({
                        abi: productInteractionDiamondAbi,
                        functionName: allow ? "grantRoles" : "revokeRoles",
                        args: [productValidator, interactionValidatorRoles],
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

            {data.productValidator && (
                <p>
                    <strong>Public Key: </strong>{" "}
                    <WalletAddress wallet={data.productValidator} />
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

            {interactionExecutor && (
                <p>
                    <strong>Interaction executor: </strong>{" "}
                    <WalletAddress wallet={interactionExecutor} />
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
}: {
    productId: Hex;
    refreshDetails: () => Promise<void>;
}) {
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
