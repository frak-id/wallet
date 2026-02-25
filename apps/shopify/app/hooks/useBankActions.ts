import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useWaitForTxAndInvalidateQueries } from "./useWaitForTxAndInvalidateQueries";

function bankQueryKey(bankAddress: Address) {
    return ["merchant-bank", bankAddress];
}

export function useSetBankOpenStatus({
    bankAddress,
}: {
    bankAddress: Address;
}) {
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    const { mutate: setOpenStatus, isPending: isSettingOpenStatus } =
        useMutation({
            mutationKey: ["bank", bankAddress, "setOpen"],
            mutationFn: async ({ isOpen }: { isOpen: boolean }) => {
                const { hash } = await sendTx({
                    tx: {
                        to: bankAddress,
                        data: encodeFunctionData({
                            abi: campaignBankAbi,
                            functionName: "setOpen",
                            args: [isOpen],
                        }),
                    },
                    metadata: {
                        header: {
                            title: isOpen ? "Open bank" : "Close bank",
                        },
                        i18n: {
                            fr: {
                                "sdk.modal.sendTransaction.description": isOpen
                                    ? "Ouvrir la banque pour la distribution"
                                    : "Fermer la banque",
                            },
                            en: {
                                "sdk.modal.sendTransaction.description": isOpen
                                    ? "Open bank for distribution"
                                    : "Close bank",
                            },
                        },
                    },
                });

                await waitForTxAndInvalidateQueries({
                    hash,
                    queryKey: bankQueryKey(bankAddress),
                });
            },
        });

    return { setOpenStatus, isSettingOpenStatus };
}

export function useUpdateBankAllowance({
    bankAddress,
}: {
    bankAddress: Address;
}) {
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["bank", bankAddress, "updateAllowance"],
        mutationFn: async ({
            token,
            amount,
        }: {
            token: Address;
            amount: bigint;
        }) => {
            const { hash } = await sendTx({
                tx: {
                    to: bankAddress,
                    data: encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "updateAllowance",
                        args: [token, amount],
                    }),
                },
                metadata: {
                    header: {
                        title: "Update allowance",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Mettre à jour l'allocation de distribution",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Update distribution allowance",
                        },
                    },
                },
            });

            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: bankQueryKey(bankAddress),
            });
        },
    });
}

export function useRevokeBankAllowance({
    bankAddress,
}: {
    bankAddress: Address;
}) {
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["bank", bankAddress, "revokeAllowance"],
        mutationFn: async ({ token }: { token: Address }) => {
            const { hash } = await sendTx({
                tx: {
                    to: bankAddress,
                    data: encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "revokeAllowance",
                        args: [token],
                    }),
                },
                metadata: {
                    header: {
                        title: "Revoke allowance",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Révoquer l'allocation de distribution",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Revoke distribution allowance",
                        },
                    },
                },
            });

            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: bankQueryKey(bankAddress),
            });
        },
    });
}

export function useWithdrawFromBank({ bankAddress }: { bankAddress: Address }) {
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["bank", bankAddress, "withdraw"],
        mutationFn: async ({
            token,
            amount,
            to,
        }: {
            token: Address;
            amount: bigint;
            to: Address;
        }) => {
            const { hash } = await sendTx({
                tx: {
                    to: bankAddress,
                    data: encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "withdraw",
                        args: [token, amount, to],
                    }),
                },
                metadata: {
                    header: {
                        title: "Withdraw funds",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Retirer les fonds de la banque",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Withdraw funds from the bank",
                        },
                    },
                },
            });

            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: bankQueryKey(bankAddress),
            });
        },
    });
}
