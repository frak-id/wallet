import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { TokenMax } from "@/module/tokens/component/TokenMax";
import { TokenModalList } from "@/module/tokens/component/TokenModalList";
import { TransactionError } from "@/module/tokens/component/TransactionError";
import { TransactionSuccess } from "@/module/tokens/component/TransactionSuccess";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
import { getUpdatedToken } from "@/module/tokens/utils/getUpdatedToken";
import { validateAmount } from "@/module/tokens/utils/validateAmount";
import type { BalanceItem } from "@/types/Balance";
import { Button } from "@shared/module/component/Button";
import { Input } from "@shared/module/component/forms/Input";
import { memo, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type {
    FieldErrors,
    SubmitHandler,
    UseFormRegister,
    UseFormResetField,
    UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { erc20Abi, parseUnits } from "viem";
import type { Hex } from "viem";
import { useWriteContract } from "wagmi";
import styles from "./tokens-send.module.css";

/**
 * Form input type definition for the token send form
 */
type FormInput = {
    toAddress: Hex;
    amount: string;
};

/**
 * AddressInput component for entering the recipient address
 */
const AddressInput = function AddressInput({
    register,
    errors,
}: {
    register: UseFormRegister<FormInput>;
    errors: FieldErrors<FormInput>;
}) {
    const { t } = useTranslation();

    return (
        <p className={styles.tokensSend__inputWrapper}>
            <label htmlFor="toAddress" className={styles.tokensSend__label}>
                {t("common.to")}
            </label>
            <Input
                type={"text"}
                id={"toAddress"}
                aria-label={t("common.enterAddress")}
                placeholder={t("common.enterAddress")}
                aria-invalid={errors.toAddress ? "true" : "false"}
                {...register("toAddress", {
                    required: t("common.walletAddressRequired"),
                    pattern: {
                        value: /^0x[0-9A-Fa-f]{40}$/,
                        message: t("common.walletInvalid"),
                    },
                })}
            />
            {errors.toAddress && (
                <span className={"error"}>{errors.toAddress.message}</span>
            )}
        </p>
    );
};

/**
 * AmountInput component for entering the token amount
 */
const AmountInput = function AmountInput({
    register,
    errors,
    selectedToken,
    setValue,
    setSelectedToken,
    resetField,
}: {
    register: UseFormRegister<FormInput>;
    errors: FieldErrors<FormInput>;
    selectedToken: BalanceItem;
    setValue: UseFormSetValue<FormInput>;
    setSelectedToken: (token: BalanceItem) => void;
    resetField: UseFormResetField<FormInput>;
}) {
    const { t } = useTranslation();

    const handleMaxClick = useCallback(() => {
        setValue("amount", selectedToken?.amount.toString(), {
            shouldValidate: true,
        });
    }, [selectedToken, setValue]);

    const handleTokenChange = useCallback(
        (token: BalanceItem) => {
            setSelectedToken(token);
            resetField("amount");
        },
        [setSelectedToken, resetField]
    );

    return (
        <p className={styles.tokensSend__inputWrapper}>
            <label htmlFor="amount" className={styles.tokensSend__label}>
                {t("common.balance")}: {selectedToken.amount}
                <TokenMax onClick={handleMaxClick} />
            </label>
            <Input
                leftSection={
                    <TokenModalList
                        token={selectedToken}
                        setSelectedToken={handleTokenChange}
                    />
                }
                type={"number"}
                step={"any"}
                id={"amount"}
                aria-label={t("wallet.tokens.amountToSend")}
                placeholder={t("wallet.tokens.amountToSend")}
                {...register("amount", {
                    required: t("common.amountRequired"),
                    validate: (value: string) =>
                        validateAmount(value, selectedToken),
                })}
                aria-invalid={errors.amount ? "true" : "false"}
            />
            {errors.amount && (
                <span className={"error"}>{errors.amount.message}</span>
            )}
        </p>
    );
};

/**
 * TransactionStatus component to display transaction status
 */
const TransactionStatus = memo(function TransactionStatus({
    isSuccess,
    isError,
    hash,
    error,
}: {
    isSuccess: boolean;
    isError: boolean;
    hash?: Hex;
    error?: { message: string } | null;
}) {
    if (isSuccess && hash) {
        return <TransactionSuccess hash={hash} />;
    }

    if (isError && error) {
        return <TransactionError message={error.message} />;
    }

    return null;
});

/**
 * TokensSend component
 *
 * This component allows users to send tokens to another address.
 * It includes:
 * - Address input for the recipient
 * - Token selection and amount input
 * - Transaction submission and status display
 *
 * @returns {JSX.Element} The rendered token send form
 */
export default function TokensSend() {
    const { t } = useTranslation();

    // Form control and validation
    const {
        register,
        handleSubmit,
        setValue,
        reset,
        resetField,
        formState: { errors },
    } = useForm<FormInput>({
        mode: "onChange",
        reValidateMode: "onChange",
    });

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
    const onSubmit: SubmitHandler<FormInput> = useCallback(
        async (data) => {
            if (!selectedToken) return;
            const { toAddress, amount } = data;

            try {
                // Launch the transaction
                await writeContractAsync({
                    abi: erc20Abi,
                    address: selectedToken.token,
                    functionName: "transfer",
                    args: [
                        toAddress,
                        parseUnits(amount, selectedToken.decimals),
                    ],
                });

                // Reset the form
                reset();

                // Refetch the tokens
                await refetch();
            } catch (err) {
                console.error("Transaction failed:", err);
                // Error is handled by useWriteContract hook
            }
        },
        [selectedToken, writeContractAsync, reset, refetch]
    );

    return (
        <>
            <Back href={"/wallet"}>{t("wallet.tokens.backToWallet")}</Back>
            <Grid>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <AddressInput register={register} errors={errors} />

                    {selectedToken && (
                        <>
                            <AmountInput
                                register={register}
                                errors={errors}
                                selectedToken={selectedToken}
                                setValue={setValue}
                                setSelectedToken={setSelectedToken}
                                resetField={resetField}
                            />

                            <p>
                                <Button
                                    type={"submit"}
                                    width={"full"}
                                    disabled={isPending}
                                    isLoading={isPending}
                                >
                                    {t("common.send")}
                                </Button>
                            </p>

                            <p className={styles.tokensSend__bottom}>
                                <TransactionStatus
                                    isSuccess={isSuccess}
                                    isError={isError}
                                    hash={hash}
                                    error={error}
                                />
                            </p>
                        </>
                    )}
                </form>
            </Grid>
        </>
    );
}
