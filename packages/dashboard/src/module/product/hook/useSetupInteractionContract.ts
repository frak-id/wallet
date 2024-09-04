import { roles } from "@/context/blockchain/roles";
import { getManagedValidatorPublicKey } from "@/context/product/action/getValidator";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { currentViemClient } from "@frak-labs/nexus-wallet/src/context/blockchain/provider";
import { productInteractionManagerAbi } from "@frak-labs/shared/context/blockchain/abis/frak-interaction-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { encodeFunctionData, toHex } from "viem";
import { readContract } from "viem/actions";

/**
 * Hook used to setup the interaction contract on the given productId
 * todo: Should have a simulation and a precise deployed address to avoid the need of 2 tw, and instead just send one batched tx
 */
export function useSetupInteractionContract() {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "deploy-interaction"],
        mutationFn: async ({
            directAllowValidator,
            productId,
        }: { productId: bigint; directAllowValidator: boolean }) => {
            // Send the deploy interaction call
            const { hash: interactionDeploymentHash } = await sendTransaction({
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
                    context:
                        "Deploying user interactions handler for your product",
                },
            });
            if (!directAllowValidator) {
                // Wait for the tx to be done, and invalidate product and campaigns related queries
                await waitForTxAndInvalidateQueries({
                    hash: interactionDeploymentHash,
                    queryKey: ["product"],
                });
                return;
            }

            // Get the manager validator address
            const { productPubKey } = await getManagedValidatorPublicKey({
                productId: toHex(productId),
            });
            if (!productPubKey) {
                return;
            }
            // Get the interaction contract address
            const interactionContractAddress = await readContract(
                currentViemClient,
                {
                    address: addresses.productInteractionManager,
                    abi: productInteractionManagerAbi,
                    functionName: "getInteractionContract",
                    args: [productId],
                }
            );
            // Allow it
            const { hash: validatorAllowanceHash } = await sendTransaction({
                tx: {
                    to: interactionContractAddress,
                    data: encodeFunctionData({
                        abi: productInteractionManagerAbi,
                        functionName: "grantRoles",
                        args: [productPubKey, roles.interactionValidatorRoles],
                    }),
                },
                metadata: {
                    header: {
                        title: "Allow managed validator",
                    },
                    context:
                        "Allowing the managed validator to approve interaction on your product",
                },
            });

            // Wait for the tx to be done, and invalidate product and campaigns related queries
            await waitForTxAndInvalidateQueries({
                hash: validatorAllowanceHash,
                queryKey: ["product"],
            });
        },
    });
}
