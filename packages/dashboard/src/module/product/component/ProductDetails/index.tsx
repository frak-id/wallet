"use client";

import { viemClient } from "@/context/blockchain/provider";
import { roles } from "@/context/blockchain/roles";
import { Panel } from "@/module/common/component/Panel";
import { ManageProductTeam } from "@/module/product/component/ProductDetails/ManageTeam";
import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import { productInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { productAdministratorRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Spinner } from "@module/component/Spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { tryit } from "radash";
import { encodeFunctionData } from "viem";
import { readContract } from "viem/actions";

export function ProductDetails({ productId }: { productId: bigint }) {
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

            return { isAllowed, interactionContract };
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

    return (
        <>
            <Panel title={"Interactions handler"}>
                {isFetchingInteractionContract && <Spinner />}
                {detailsData?.interactionContract && (
                    <>
                        <div>
                            Interaction contract:{" "}
                            <pre>{detailsData.interactionContract}</pre>
                        </div>
                        {detailsData?.isAllowed && (
                            <button
                                type={"button"}
                                onClick={() => deleteInteraction()}
                            >
                                Remove interaction handler
                            </button>
                        )}
                    </>
                )}
                {!(
                    isFetchingInteractionContract ||
                    detailsData?.interactionContract
                ) && (
                    <>
                        <div>No interaction contract deployed</div>
                        {detailsData?.isAllowed && (
                            <button
                                type={"button"}
                                onClick={() => deployInteraction()}
                            >
                                Deploy interaction handler
                            </button>
                        )}
                    </>
                )}
            </Panel>
            <ManageProductTeam productId={productId} />
        </>
    );
}
