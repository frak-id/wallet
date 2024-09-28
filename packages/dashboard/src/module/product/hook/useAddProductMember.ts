import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import {
    type ProductRolesKey,
    addresses,
    productAdministratorRegistryAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, encodeFunctionData } from "viem";

type AddProductMemberArg = {
    productId: Hex;
    wallet: Address;
    roles: ProductRolesKey[];
};

export function useAddProductMember() {
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["product", "add-member"],
        mutationFn: async (args: AddProductMemberArg) => {
            // Create the map of role keys to roles
            const rolesToAdd = args.roles
                .map((roleKey) => productRoles[roleKey])
                .reduce((acc, role) => acc | role, 0n);

            // Craft the transaction
            const txData = encodeFunctionData({
                abi: productAdministratorRegistryAbi,
                functionName: "grantRoles",
                args: [BigInt(args.productId), args.wallet, rolesToAdd],
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
