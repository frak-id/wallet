"use client";

import { viemClient } from "@/context/blockchain/provider";
import { Panel } from "@/module/common/component/Panel";
import { ManageProductTeam } from "@/module/product/component/ProductDetails/ManageTeam";
import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import { contentInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
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

            // Check if the user is allowed on the content
            const isAllowed = await readContract(viemClient, {
                abi: contentInteractionManagerAbi,
                functionName: "isAllowedOnContent",
                address: addresses.contentInteractionManager,
                args: [productId, walletStatus.wallet],
            });

            // Fetch the on chain interaction contract
            const [, interactionContract] = await tryit(() =>
                readContract(viemClient, {
                    abi: contentInteractionManagerAbi,
                    functionName: "getInteractionContract",
                    address: addresses.contentInteractionManager,
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
                    to: addresses.contentInteractionManager,
                    data: encodeFunctionData({
                        abi: contentInteractionManagerAbi,
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
                    to: addresses.contentInteractionManager,
                    data: encodeFunctionData({
                        abi: contentInteractionManagerAbi,
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
