import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();

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
                            title: isOpen
                                ? t("status.bank.modal.rewardsOnTitle")
                                : t("status.bank.modal.rewardsOffTitle"),
                        },
                        i18n: {
                            fr: {
                                "sdk.modal.sendTransaction.description": isOpen
                                    ? "Autoriser Frak à verser les récompenses depuis votre budget de récompenses"
                                    : "Arrêter de verser les récompenses depuis votre budget de récompenses",
                            },
                            en: {
                                "sdk.modal.sendTransaction.description": isOpen
                                    ? "Allow Frak to pay rewards from your reward budget"
                                    : "Stop paying rewards from your reward budget",
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
    const { t } = useTranslation();

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
                        title: t("status.bank.modal.limitTitle"),
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Modifier le maximum que Frak peut verser en récompenses depuis votre budget",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Change the most Frak can pay as rewards from your budget",
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
    const { t } = useTranslation();

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
                        title: t("status.bank.modal.pauseTitle"),
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Mettre la limite de dépense à zéro. Les récompenses s'arrêtent jusqu'à ce que vous l'augmentiez",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Set the spending limit to zero. Rewards stop until you raise it again",
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
    const { t } = useTranslation();

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
                        title: t("status.bank.modal.withdrawTitle"),
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Retirer des fonds de votre budget de récompenses vers votre porte-monnaie Frak",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Withdraw funds from your reward budget to your Frak wallet",
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
