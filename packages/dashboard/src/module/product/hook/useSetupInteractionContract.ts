import { viemClient } from "@/context/blockchain/provider";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import {
    addresses,
    interactionValidatorRoles,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import type { SendTransactionModalStepType } from "@frak-labs/nexus-sdk/core";
import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, encodeFunctionData } from "viem";
import { readContract, simulateContract } from "viem/actions";

/**
 * Hook used to setup the interaction contract on the given productId
 */
export function useSetupInteractionContract() {
    const { data: walletStatus } = useWalletStatus();
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "deploy-interaction"],
        mutationFn: async ({
            productId,
            salt,
        }: { productId: Hex; salt?: Hex }) => {
            // early exit if user not logged in
            if (!walletStatus?.wallet) return;

            // Predicate final address
            const { address: interactionContract, shouldDeploy } =
                await getFutureInteractionContract({
                    wallet: walletStatus.wallet,
                    productId,
                    salt,
                });

            // The array of tx we will send
            const tx: SendTransactionModalStepType["params"]["tx"] = [];

            // Check if we need to deploy the interaction contract or not
            if (shouldDeploy) {
                // If no current code, add the deployment tx
                tx.push({
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deployInteractionContract",
                        args: salt
                            ? [BigInt(productId), salt]
                            : [BigInt(productId)],
                    }),
                });
            }
            // Get the manager validator address
            const { data } = await backendApi.common.adminWallet.get({
                query: {
                    productId: productId,
                },
            });
            if (!data?.pubKey) {
                console.log(
                    "Error getting the product pub key or the predicted interaction address",
                    { data, interactionContract }
                );
                return;
            }
            const productPubKey = data.pubKey;

            // Add the second tx to allow the managed validator
            tx.push({
                to: interactionContract,
                data: encodeFunctionData({
                    abi: productInteractionManagerAbi,
                    functionName: "grantRoles",
                    args: [productPubKey, interactionValidatorRoles],
                }),
            });

            // Send the deploy interaction call
            const { hash } = await sendTransaction({
                tx,
                metadata: {
                    header: {
                        title: "Deploy interaction handler",
                    },
                    context:
                        "Deploying user interactions handler for your product",
                },
            });

            // Wait for the tx to be done, and invalidate product and campaigns related queries
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["product"],
            });
        },
    });
}

/**
 * Get a potentially future interaction contract
 * @param wallet
 * @param productId
 * @param salt
 */
async function getFutureInteractionContract({
    wallet,
    productId,
    salt,
}: { wallet: Address; productId: Hex; salt?: Hex }) {
    try {
        const interactionContract = await readContract(viemClient, {
            address: addresses.productInteractionManager,
            abi: productInteractionManagerAbi,
            functionName: "getInteractionContract",
            args: [BigInt(productId)],
        });
        return { address: interactionContract, shouldDeploy: false };
    } catch (e) {
        console.log("Error getting the interaction contract", {
            error: e,
            productId,
        });
        // If we got an error, it mean that the contract isn't deployed yet, so we need to predicate it's address
        const { result: predictedInteractionAddress } = await simulateContract(
            viemClient,
            {
                account: wallet,
                address: addresses.productInteractionManager,
                abi: productInteractionManagerAbi,
                functionName: "deployInteractionContract",
                args: salt ? [BigInt(productId), salt] : [BigInt(productId)],
            }
        );
        return { address: predictedInteractionAddress, shouldDeploy: true };
    }
}
