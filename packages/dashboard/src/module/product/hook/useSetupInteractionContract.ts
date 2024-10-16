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
import { type Hex, encodeFunctionData } from "viem";
import { simulateContract } from "viem/actions";

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
            directAllowValidator,
            productId,
            salt,
        }: { productId: Hex; directAllowValidator: boolean; salt?: Hex }) => {
            // early exit if user not logged in
            if (!walletStatus?.wallet) return;

            // First tx to deploy the interaction contract
            const tx: SendTransactionModalStepType["params"]["tx"] = [
                {
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deployInteractionContract",
                        args: salt
                            ? [BigInt(productId), salt]
                            : [BigInt(productId)],
                    }),
                },
            ];

            // If we directly want to allow the managed validator, add another tx
            if (directAllowValidator) {
                // Predicate final address
                const { result: predictedInteractionAddress } =
                    await simulateContract(viemClient, {
                        account: walletStatus?.wallet,
                        address: addresses.productInteractionManager,
                        abi: productInteractionManagerAbi,
                        functionName: "deployInteractionContract",
                        args: salt
                            ? [BigInt(productId), salt]
                            : [BigInt(productId)],
                    });

                // Get the manager validator address
                const result = await backendApi.common.adminWallet.get({
                    query: {
                        productId: productId,
                    },
                });
                if (!(result?.data?.pubKey && predictedInteractionAddress)) {
                    console.log(
                        "Error getting the product pub key or the predicted interaction address",
                        { result, predictedInteractionAddress }
                    );
                    return;
                }
                const productPubKey = result.data.pubKey;

                // Add the second tx to allow the managed validator
                tx.push({
                    to: predictedInteractionAddress,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "grantRoles",
                        args: [productPubKey, interactionValidatorRoles],
                    }),
                });
            }

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
