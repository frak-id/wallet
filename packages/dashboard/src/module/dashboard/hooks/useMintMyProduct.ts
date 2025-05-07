import { useGetAdminWallet } from "@/module/common/hook/useGetAdminWallet";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import {
    addresses,
    campaignBankAbi,
    interactionValidatorRoles,
    productAdministratorRegistryAbi,
    productInteractionManagerAbi,
    productRoles,
} from "@frak-labs/app-essentials/blockchain";
import type {
    ProductTypesKey,
    SendTransactionModalStepType,
} from "@frak-labs/core-sdk";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { backendApi } from "@frak-labs/shared/context/server";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { type Hex, encodeFunctionData } from "viem";

/**
 * Hook to mint the user product
 */
export function useMintMyProduct(
    options?: UseMutationOptions<
        { mintTxHash: Hex },
        Error,
        {
            name: string;
            domain: string;
            setupCode: string;
            productTypes: ProductTypesKey[];
        }
    >
) {
    const { data: oracleUpdater } = useGetAdminWallet({
        key: "oracle-updater",
    });
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    const [infoTxt, setInfoTxt] = useState<string | undefined>();

    const mutation = useMutation({
        ...options,
        mutationKey: ["product", "launch-mint"],
        onSettled() {
            // Clear info post mutation
            setInfoTxt(undefined);
        },
        async mutationFn({ name, domain, setupCode, productTypes }) {
            // Trigger the backend mint
            setInfoTxt("Registering your product");
            const { data, error } = await backendApi.business.mint.put({
                name,
                domain,
                setupCode,
                productTypes,
            });
            if (error) throw error;

            // Compute the post mint transaction to be done
            setInfoTxt("Preparing post setup validation");
            const tx: SendTransactionModalStepType["params"]["tx"] = [];

            // If we got a banking contract, activate it on mint
            if (data.bankContract) {
                tx.push({
                    to: data.bankContract,
                    data: encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "updateDistributionState",
                        args: [true],
                    }),
                });
            }

            // If we got a interaction contract, allow the managed validator on it
            if (data.interactionContract) {
                // Get the manager validator address
                const { data: delegatedManagerWallet } =
                    await backendApi.common.adminWallet.get({
                        query: {
                            productId: data.productId,
                        },
                    });
                if (delegatedManagerWallet?.pubKey) {
                    tx.push({
                        to: data.interactionContract,
                        data: encodeFunctionData({
                            abi: productInteractionManagerAbi,
                            functionName: "grantRoles",
                            args: [
                                delegatedManagerWallet?.pubKey,
                                interactionValidatorRoles,
                            ],
                        }),
                    });
                }
            }

            // If that's a product related oracle, enable the purchase oracle by default
            if (productTypes.includes("purchase") && oracleUpdater) {
                tx.push({
                    to: addresses.productAdministratorRegistry,
                    data: encodeFunctionData({
                        abi: productAdministratorRegistryAbi,
                        functionName: "grantRoles",
                        args: [
                            BigInt(data.productId),
                            oracleUpdater,
                            productRoles.purchaseOracleUpdater,
                        ],
                    }),
                });
            }

            // Send all the post mint transactions
            if (tx.length) {
                setInfoTxt("Waiting for post setup validation");
                const { hash } = await sendTransaction({
                    tx,
                    metadata: {
                        header: {
                            title: "Post mint setup",
                        },
                        i18n: {
                            fr: {
                                "sdk.modal.sendTransaction.description":
                                    "Configuration du produit après la création",
                            },
                            en: {
                                "sdk.modal.sendTransaction.description":
                                    "Setting up the product post mint",
                            },
                        },
                    },
                });

                // Wait for the post setup tx to be done, and invalidate product
                await waitForTxAndInvalidateQueries({
                    hash,
                    queryKey: ["product"],
                    confirmations: 4,
                });
            }

            // Wait for the mint tx to be done, and invalidated everything related to the campaigns
            setInfoTxt("Verifying everything");
            await waitForTxAndInvalidateQueries({
                hash: data.txHash,
                queryKey: ["product"],
                confirmations: 16,
            });

            return {
                mintTxHash: data.txHash,
            };
        },
    });

    return { mutation, infoTxt };
}
