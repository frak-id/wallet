import { viemClient } from "@/context/blockchain/provider";
import { roles } from "@/context/blockchain/roles";
import { getProductAdministrators } from "@/context/product/action/getAdministrators";
import { Panel } from "@/module/common/component/Panel";
import { useIsProductOwner } from "@/module/product/hook/useIsProductOwner";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { productAdministratorRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { Spinner } from "@module/component/Spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData, isAddress, toHex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

/**
 * Component to manage a product team
 * @constructor
 */
export function ManageProductTeam({ productId }: { productId: bigint }) {
    const queryClient = useQueryClient();
    const { data: isProductOwner } = useIsProductOwner({ productId });
    const { mutateAsync: sendTransaction } = useSendTransactionAction();

    const { data: administrators, isLoading } = useQuery({
        queryKey: ["product", "team", productId.toString()],
        queryFn: () =>
            getProductAdministrators({ productId: toHex(productId) }),
    });

    const {
        isPending: isUpdatingAdministrators,
        error: updateAdministratorError,
    } = useMutation({
        mutationKey: ["product", "add-administrator"],
        onMutate: async ({
            wallet,
            isAddition,
        }: { wallet: Address; isAddition: boolean }) => {
            // Ensure the wallet is valid
            if (!isAddress(wallet)) {
                throw new Error("Invalid wallet");
            }

            // Send the transaction
            const { hash } = await sendTransaction({
                tx: {
                    to: addresses.productAdministratorRegistry,
                    data: encodeFunctionData({
                        abi: productAdministratorRegistryAbi,
                        functionName: isAddition ? "grantRoles" : "revokeRoles",
                        args: [productId, wallet, roles.productManager],
                    }),
                },
                metadata: {
                    header: {
                        title: "Manage team",
                    },
                    context: isAddition
                        ? "Adding operator"
                        : "Removing operator",
                },
            });

            // Wait a bit for the indexer to pick it up
            await waitForTransactionReceipt(viemClient, {
                hash,
                confirmations: 32,
                retryCount: 32,
            });

            // Invalidate the query
            await queryClient.invalidateQueries({
                queryKey: ["product", "team", productId.toString()],
            });
        },
    });

    if (isLoading) {
        return (
            <Panel title={"Manage your team"}>
                <Spinner />
            </Panel>
        );
    }

    if (!administrators) {
        return (
            <Panel title={"Manage your team"}>
                <p>Could not load your team</p>
            </Panel>
        );
    }

    return (
        <Panel title={"Manage your team"}>
            {/* Display the add administrator form if it's a product owner */}
            {isProductOwner && (
                <div>
                    <p>Add an administrator</p>
                    <input type="text" placeholder="Wallet address" />
                    <button disabled={isUpdatingAdministrators} type={"button"}>
                        Add
                    </button>
                </div>
            )}
            {/* Display the error if there is one */}
            {updateAdministratorError && (
                <p>{updateAdministratorError.message}</p>
            )}
            {/* Display the administrators */}
            {administrators.map((admin) => (
                <div key={admin.wallet}>
                    <p>{admin.wallet}</p>
                    <p>{admin.isOwner ? "Admin" : "Operator"}</p>
                </div>
            ))}
        </Panel>
    );
}
