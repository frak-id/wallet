import { Button } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useState } from "react";
import type {
    FieldErrors,
    SubmitHandler,
    UseFormRegister,
    UseFormResetField,
    UseFormSetValue,
} from "react-hook-form";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { erc20Abi, parseUnits } from "viem";
import { useWriteContract } from "wagmi";
import { useBiometricConfirm } from "@/module/biometrics/hooks/useBiometricConfirm";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { TokenMax } from "@/module/tokens/component/TokenMax";
import { TokenModalList } from "@/module/tokens/component/TokenModalList";
import { TransactionError } from "@/module/tokens/component/TransactionError";
import { TransactionSuccess } from "@/module/tokens/component/TransactionSuccess";
import styles from "@/module/tokens/page/TokensSendPage.module.css";
import { getUpdatedToken } from "@/module/tokens/utils/getUpdatedToken";
import { validateAmount } from "@/module/tokens/utils/validateAmount";

export const Route = createFileRoute("/_wallet/_protected/tokens/send")({
    component: TokensSendPage,
});

type FormInput = {
    toAddress: Hex;
    amount: string;
};

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

function TokensSendPage() {
    const { t } = useTranslation();
    const { confirm, isConfirming } = useBiometricConfirm();

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

    const { userBalance, refetch } = useGetUserBalance();

    const [selectedToken, setSelectedToken] = useState<
        BalanceItem | undefined
    >();

    const {
        writeContractAsync,
        data: hash,
        error,
        isPending,
        isSuccess,
        isError,
    } = useWriteContract();

    useEffect(() => {
        if (!userBalance) return;

        if (!selectedToken) {
            setSelectedToken(userBalance.balances[0]);
            return;
        }

        const findTokenUpdated = getUpdatedToken({
            tokens: userBalance.balances,
            selectedToken,
        });
        if (findTokenUpdated) setSelectedToken(findTokenUpdated);
    }, [userBalance, selectedToken]);

    const onSubmit: SubmitHandler<FormInput> = useCallback(
        async (data) => {
            if (!selectedToken) return;

            const confirmed = await confirm();
            if (!confirmed) return;

            const { toAddress, amount } = data;

            try {
                await writeContractAsync({
                    abi: erc20Abi,
                    address: selectedToken.token,
                    functionName: "transfer",
                    args: [
                        toAddress,
                        parseUnits(amount, selectedToken.decimals),
                    ],
                });

                reset();
                await refetch();
            } catch (err) {
                console.error("Transaction failed:", err);
            }
        },
        [selectedToken, writeContractAsync, reset, refetch, confirm]
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
                                    disabled={isPending || isConfirming}
                                    isLoading={isPending || isConfirming}
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
