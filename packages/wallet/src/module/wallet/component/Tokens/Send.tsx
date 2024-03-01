"use client";

import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Back } from "@/module/common/component/Back";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Grid } from "@/module/common/component/Grid";
import { Input } from "@/module/common/component/Input";
import { useGetUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { TokenList } from "@/module/wallet/component/TokenList";
import { TokenLogo } from "@/module/wallet/component/TokenLogo";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { formatEther, parseEther } from "viem";
import type { Hex } from "viem";
import styles from "./send.module.css";
import { useWriteContract } from "wagmi";
import { erc20Abi } from "viem";
import { useWallet } from "@/module/wallet/provider/WalletProvider";

type FormInput = {
    walletAddress: Hex;
    amount: string;
};

export function TokensSend() {
    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<FormInput>();
    const { tokens } = useGetUserTokens();
    const [selectedToken, setSelectedToken] = useState<GetUserErc20Token>();
    const [openModal, setOpenModal] = useState(false);
    const { writeContractAsync, data, error } = useWriteContract();
    const { refreshBalance } = useWallet();
    console.log(data, error);

    useEffect(() => {
        if (!tokens) return;
        setSelectedToken(tokens[0]);
    }, [tokens?.[0]]);

    const onSubmit: SubmitHandler<FormInput> = async (data) => {
        console.log(data);
        console.log(selectedToken);
        if (!selectedToken) return;
        const { walletAddress, amount } = data;
        // console.log(parseEther(amount));
        // return;
        const result = await writeContractAsync({
            abi: erc20Abi,
            address: selectedToken.contractAddress,
            functionName: "transfer",
            args: [walletAddress, parseEther(amount)],
        });
        console.log(result);
        refreshBalance();
    };

    const modalTokens = (
        <AlertDialog
            title={"Select a token"}
            text={
                <TokenList
                    setSelectedValue={(token) => {
                        setSelectedToken(token);
                        setOpenModal(false);
                    }}
                />
            }
            button={{
                label: (
                    <>
                        <TokenLogo token={selectedToken} />
                        <span>{selectedToken?.metadata.symbol}</span>
                    </>
                ),
                className: styles.tokensSend__trigger,
            }}
            open={openModal}
            onOpenChange={(open) => setOpenModal(open)}
        />
    );

    const buttonSetToMax = selectedToken?.tokenBalance ? (
        <button
            type={"button"}
            className={styles.tokensSend__buttonMax}
            onClick={() => {
                setValue("amount", formatEther(selectedToken.tokenBalance), {
                    shouldValidate: true,
                });
            }}
        >
            MAX
        </button>
    ) : null;

    return (
        <>
            <Back href={"/wallet"}>Back to wallet page</Back>
            <Grid>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <p className={styles.tokensSend__inputWrapper}>
                        <label
                            htmlFor="walletAddress"
                            className={styles.tokensSend__label}
                        >
                            To
                        </label>
                        <Input
                            type={"text"}
                            id={"walletAddress"}
                            aria-label="Enter address"
                            placeholder="Enter address"
                            aria-invalid={
                                errors.walletAddress ? "true" : "false"
                            }
                            {...register("walletAddress", {
                                required: "Wallet address is required",
                                pattern: {
                                    value: /^0x[0-9A-Fa-f]{40}$/,
                                    message: "Invalid wallet address",
                                },
                            })}
                        />
                        {errors.walletAddress && (
                            <span className={"error"}>
                                {errors.walletAddress.message}
                            </span>
                        )}
                    </p>
                    {selectedToken && (
                        <>
                            <p className={styles.tokensSend__inputWrapper}>
                                <label
                                    htmlFor="amount"
                                    className={styles.tokensSend__label}
                                >
                                    Balance:{" "}
                                    {formatEther(selectedToken.tokenBalance)}
                                    {buttonSetToMax}
                                </label>
                                <Input
                                    leftSection={modalTokens}
                                    type={"number"}
                                    id={"amount"}
                                    aria-label="Amount to send"
                                    placeholder="Amount to send"
                                    {...register("amount", {
                                        required: "Amount is required",
                                    })}
                                    aria-invalid={
                                        errors.amount ? "true" : "false"
                                    }
                                />
                                {errors.amount && (
                                    <span className={"error"}>
                                        {errors.amount.message}
                                    </span>
                                )}
                            </p>
                            <p>
                                <ButtonRipple type={"submit"}>
                                    Send
                                </ButtonRipple>
                            </p>
                        </>
                    )}
                </form>
            </Grid>
        </>
    );
}
