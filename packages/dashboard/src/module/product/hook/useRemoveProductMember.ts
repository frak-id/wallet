import { type RolesKeys, roles } from "@/context/blockchain/roles";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import {
    addresses,
    productAdministratorRegistryAbi,
} from "@frak-labs/constant";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, encodeFunctionData } from "viem";

type RemoveProductMemberArg = {
    productId: Hex;
} & (
    | { fullRemoval: true }
    | { fullRemoval: false; rolesToDelete: RolesKeys[] }
) &
    ({ isRenouncing: true } | { isRenouncing: false; wallet: Address });

/**
 * Hook to remove or renounce a member from a product
 */
export function useRemoveProductMember() {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "remove-member"],
        mutationFn: async (args: RemoveProductMemberArg) => {
            const productId = BigInt(args.productId);
            // Build the right tx data based on the arguments
            let txData: Hex;
            if (args.fullRemoval && args.isRenouncing) {
                txData = encodeFunctionData({
                    abi: productAdministratorRegistryAbi,
                    functionName: "renounceAllRoles",
                    args: [productId],
                });
            } else if (args.fullRemoval && !args.isRenouncing) {
                txData = encodeFunctionData({
                    abi: productAdministratorRegistryAbi,
                    functionName: "revokeAllRoles",
                    args: [productId, args.wallet],
                });
            } else {
                // Otherwise, build our roles bitmap
                const rolesMaskToDelete = args.rolesToDelete
                    .map((roleKey) => roles[roleKey])
                    .reduce((acc, role) => acc | role, 0n);
                // And craft the tx based on that
                txData = args.isRenouncing
                    ? encodeFunctionData({
                          abi: productAdministratorRegistryAbi,
                          functionName: "renounceRoles",
                          args: [productId, rolesMaskToDelete],
                      })
                    : encodeFunctionData({
                          abi: productAdministratorRegistryAbi,
                          functionName: "revokeRoles",
                          args: [productId, args.wallet, rolesMaskToDelete],
                      });
            }

            // Send the transaction
            const { hash } = await sendTransaction({
                tx: {
                    to: addresses.productAdministratorRegistry,
                    data: txData,
                },
                metadata: {
                    header: {
                        title: args.isRenouncing
                            ? "Renouncing"
                            : "Updating member",
                    },
                    context: args.isRenouncing
                        ? "Renouncing to a permissions on the product"
                        : `Revoking permissions to ${args.wallet} on the product`,
                },
            });

            // Wait a bit for the tx to be confirmed
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["product"],
            });
        },
    });
}
