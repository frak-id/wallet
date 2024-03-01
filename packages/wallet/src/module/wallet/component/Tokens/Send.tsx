"use client";

import { userErc20TokensRevalidate } from "@/context/tokens/action/getTokenAsset";
import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Back } from "@/module/common/component/Back";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Grid } from "@/module/common/component/Grid";
import { Input } from "@/module/common/component/Input";
import { useGetUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import { TokenList } from "@/module/wallet/component/TokenList";
import { TokenLogo } from "@/module/wallet/component/TokenLogo";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { erc20Abi, parseUnits } from "viem";
import type { Hex } from "viem";
import { useWriteContract } from "wagmi";
import styles from "./send.module.css";

type FormInput = {
    toAddress: Hex;
    amount: string;
};

export function TokensSend() {
    const {
        register,
        handleSubmit,
        setValue,
        reset,
        formState: { errors },
    } = useForm<FormInput>();
    const { tokens, refetch } = useGetUserTokens();
    const [selectedToken, setSelectedToken] = useState<GetUserErc20Token>();
    const [openModal, setOpenModal] = useState(false);
    const {
        writeContractAsync,
        data: hash,
        error,
        isPending,
        isSuccess,
        isError,
    } = useWriteContract();

    useEffect(() => {
        if (!tokens) return;
        setSelectedToken(tokens[0]);
    }, [tokens?.[0]]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: trigger only when tokens change, not when the selected token changes
    useEffect(() => {
        if (!tokens) return;
        const findTokenUpdated = tokens.find(
            ({ contractAddress, formattedBalance }) =>
                contractAddress === selectedToken?.contractAddress &&
                formattedBalance !== selectedToken?.formattedBalance
        );
        if (findTokenUpdated) setSelectedToken(findTokenUpdated);
    }, [tokens]);

    const onSubmit: SubmitHandler<FormInput> = async (data) => {
        if (!selectedToken) return;
        const { toAddress, amount } = data;

        // Launch the transaction
        await writeContractAsync({
            abi: erc20Abi,
            address: selectedToken.contractAddress,
            functionName: "transfer",
            args: [
                toAddress,
                parseUnits(amount, selectedToken.metadata.decimals),
            ],
        });

        // Reset the form
        reset();

        // Invalidate the user tokens
        await userErc20TokensRevalidate();

        // Refetch the tokens
        await refetch();
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
                setValue("amount", selectedToken?.formattedBalance, {
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
                            htmlFor="toAddress"
                            className={styles.tokensSend__label}
                        >
                            To
                        </label>
                        <Input
                            type={"text"}
                            id={"toAddress"}
                            aria-label="Enter address"
                            placeholder="Enter address"
                            aria-invalid={errors.toAddress ? "true" : "false"}
                            {...register("toAddress", {
                                required: "Wallet address is required",
                                pattern: {
                                    value: /^0x[0-9A-Fa-f]{40}$/,
                                    message: "Invalid wallet address",
                                },
                            })}
                        />
                        {errors.toAddress && (
                            <span className={"error"}>
                                {errors.toAddress.message}
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
                                    Balance: {selectedToken.formattedBalance}
                                    {buttonSetToMax}
                                </label>
                                <Input
                                    leftSection={modalTokens}
                                    type={"number"}
                                    step={"any"}
                                    id={"amount"}
                                    aria-label="Amount to send"
                                    placeholder="Amount to send"
                                    {...register("amount", {
                                        required: "Amount is required",
                                        validate: {
                                            positive: (value) =>
                                                parseFloat(value) > 0 ||
                                                "Amount must be positive",
                                            lessThanBalance: (value) =>
                                                parseFloat(value) <=
                                                    parseFloat(
                                                        selectedToken.formattedBalance
                                                    ) ||
                                                "Amount must be less than balance",
                                        },
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
                                <ButtonRipple
                                    type={"submit"}
                                    disabled={isPending}
                                    isLoading={isPending}
                                >
                                    Send
                                </ButtonRipple>
                            </p>
                            <p className={styles.tokensSend__bottom}>
                                {isSuccess && (
                                    <>
                                        Transaction Success!
                                        <br />
                                        <br />
                                        Transaction Hash:{" "}
                                        <PolygonLink
                                            hash={hash as Hex}
                                            icon={false}
                                            className={
                                                styles.tokensSend__polygonLink
                                            }
                                        />
                                    </>
                                )}
                                {isError && (
                                    <span className={"error"}>
                                        {error?.message}
                                    </span>
                                )}
                            </p>
                        </>
                    )}
                </form>
            </Grid>
        </>
    );
}
