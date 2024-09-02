import { type RolesKeys, roles } from "@/context/blockchain/roles";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { productAdministratorRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { type Address, encodeFunctionData, maxUint256 } from "viem";

type RemoveProductMemberArg = {
    productId: bigint;
} & (
    | { fullRemoval: true }
    | { fullRemoval: false; rolesToDelete: RolesKeys[] }
) &
    ({ isRenouncing: true } | { isRenouncing: false; wallet: Address });

export function useRemoveProductMember() {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "remove-member"],
        mutationFn: async (args: RemoveProductMemberArg) => {
            // Create the map of role keys to roles
            const rolesMaskToDelete = args.fullRemoval
                ? maxUint256
                : args.rolesToDelete
                      .map((roleKey) => roles[roleKey])
                      .reduce((acc, role) => acc | role, 0n);

            // Craft the transaction (different data if we are renouncing roles or revoking them)
            const txData = args.isRenouncing
                ? encodeFunctionData({
                      abi: productAdministratorRegistryAbi,
                      functionName: "renounceRoles",
                      args: [args.productId, rolesMaskToDelete],
                  })
                : encodeFunctionData({
                      abi: productAdministratorRegistryAbi,
                      functionName: "revokeRoles",
                      args: [args.productId, args.wallet, rolesMaskToDelete],
                  });

            // Send the transaction
            const { hash } = await sendTransaction({
                tx: {
                    to: addresses.productAdministratorRegistry,
                    data: txData,
                },
                metadata: {
                    header: {
                        title: "Remove member",
                    },
                    context: args.isRenouncing
                        ? "Renouncing permissions on the product"
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
