"use client";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { TokenMax } from "@/module/tokens/component/TokenMax";
import { TokenModalList } from "@/module/tokens/component/TokenModalList";
import {
    getUpdatedToken,
    validateAmount,
} from "@/module/tokens/component/TokensSend/utils";
import { TransactionError } from "@/module/tokens/component/TransactionError";
import { TransactionSuccess } from "@/module/tokens/component/TransactionSuccess";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
import type { BalanceItem } from "@/types/Token";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { Input } from "@module/component/forms/Input";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { erc20Abi, parseUnits } from "viem";
import type { Hex } from "viem";
import { useWriteContract } from "wagmi";
import styles from "./index.module.css";

type FormInput = {
    toAddress: Hex;
    amount: string;
};

export function TokensSend() {
    // Form control and validation
    const {
        register,
        handleSubmit,
        setValue,
        reset,
        resetField,
        formState: { errors },
    } = useForm<FormInput>();

    // Get the user tokens
    const { userBalance, refetch } = useGetUserBalance();

    // Set the selected token
    const [selectedToken, setSelectedToken] = useState<
        BalanceItem | undefined
    >();

    // Get the write contract function
    const {
        writeContractAsync,
        data: hash,
        error,
        isPending,
        isSuccess,
        isError,
    } = useWriteContract();

    /**
     * When the tokens change, check if the selected token has been updated
     */
    useEffect(() => {
        if (!userBalance) return;

        // If no token is selected, select the FRK token by default
        if (!selectedToken) {
            setSelectedToken(userBalance.balances[0]);
            return;
        }

        // If the selected token has been updated, update the selected token
        const findTokenUpdated = getUpdatedToken({
            tokens: userBalance.balances,
            selectedToken,
        });
        if (findTokenUpdated) setSelectedToken(findTokenUpdated);
    }, [userBalance, selectedToken]);

    // Submit handler that launches the transaction
    const onSubmit: SubmitHandler<FormInput> = async (data) => {
        if (!selectedToken) return;
        const { toAddress, amount } = data;

        // Launch the transaction
        await writeContractAsync({
            abi: erc20Abi,
            address: selectedToken.token,
            functionName: "transfer",
            args: [toAddress, parseUnits(amount, selectedToken.decimals)],
        });

        // Reset the form
        reset();

        // Refetch the tokens
        await refetch();
    };

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
                                    Balance: {selectedToken.balance}
                                    <TokenMax
                                        onClick={() => {
                                            setValue(
                                                "amount",
                                                selectedToken?.balance.toString(),
                                                {
                                                    shouldValidate: true,
                                                }
                                            );
                                        }}
                                    />
                                </label>
                                <Input
                                    leftSection={
                                        <TokenModalList
                                            token={selectedToken}
                                            setSelectedToken={(value) => {
                                                setSelectedToken(value);
                                                resetField("amount");
                                            }}
                                        />
                                    }
                                    type={"number"}
                                    step={"any"}
                                    id={"amount"}
                                    aria-label="Amount to send"
                                    placeholder="Amount to send"
                                    {...register("amount", {
                                        required: "Amount is required",
                                        validate: (value) =>
                                            validateAmount(
                                                value,
                                                selectedToken
                                            ),
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
                                    size={"small"}
                                    disabled={isPending}
                                    isLoading={isPending}
                                >
                                    Send
                                </ButtonRipple>
                            </p>
                            <p className={styles.tokensSend__bottom}>
                                {isSuccess && hash && (
                                    <TransactionSuccess hash={hash} />
                                )}
                                {isError && error && (
                                    <TransactionError message={error.message} />
                                )}
                            </p>
                        </>
                    )}
                </form>
            </Grid>
        </>
    );
}
