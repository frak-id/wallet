import { interactionValidatorRoles } from "@/context/blockchain/roles";
import { getManagedValidatorPublicKey } from "@/context/product/action/getValidator";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import type { SendTransactionModalStepType } from "@frak-labs/nexus-sdk/core";
import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import { currentViemClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { productInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { type Hex, encodeFunctionData } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { simulateContract } from "viem/actions";

/**
 * Hook used to setup the interaction contract on the given productId
 * todo: Should have a simulation and a precise deployed address to avoid the need of 2 tw, and instead just send one batched tx
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
        }: { productId: Hex; directAllowValidator: boolean }) => {
            // early exit if user not logged in
            if (walletStatus?.key !== "connected") return;

            // Generate a random bytes32
            const randomBytes32 = generatePrivateKey();

            // First tx to deploy the interaction contract
            const tx: SendTransactionModalStepType["params"]["tx"] = [
                {
                    to: addresses.productInteractionManager,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "deployInteractionContract",
                        args: [BigInt(productId), randomBytes32],
                    }),
                },
            ];

            // If we directly want to allow the managed validator, add another tx
            if (directAllowValidator) {
                // Predicate final address
                const { result: predictedInteractionAddress } =
                    await simulateContract(currentViemClient, {
                        account: walletStatus.wallet,
                        address: addresses.productInteractionManager,
                        abi: productInteractionManagerAbi,
                        functionName: "deployInteractionContract",
                        args: [BigInt(productId), randomBytes32],
                    });

                // Get the manager validator address
                const { productPubKey } = await getManagedValidatorPublicKey({
                    productId: productId,
                });
                if (!(productPubKey && predictedInteractionAddress)) {
                    console.log(
                        "Error getting the product pub key or the predicted interaction address",
                        { productPubKey, predictedInteractionAddress }
                    );
                    return;
                }

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
