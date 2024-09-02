import { type RolesKeys, roles } from "@/context/blockchain/roles";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { productAdministratorRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";

type AddProductMemberArg = {
    productId: bigint;
    wallet: Address;
    roles: RolesKeys[];
};

export function useAddProductMember() {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "add-member"],
        mutationFn: async (args: AddProductMemberArg) => {
            // Create the map of role keys to roles
            const rolesToAdd = args.roles
                .map((roleKey) => roles[roleKey])
                .reduce((acc, role) => acc | role, 0n);

            // Craft the transaction
            const txData = encodeFunctionData({
                abi: productAdministratorRegistryAbi,
                functionName: "grantRoles",
                args: [args.productId, args.wallet, rolesToAdd],
            });

            // Send the transaction
            const { hash } = await sendTransaction({
                tx: {
                    to: addresses.productAdministratorRegistry,
                    data: txData,
                },
                metadata: {
                    header: {
                        title: "Add member",
                    },
                    context: `Granting permissions to ${args.wallet} on the product`,
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
