import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { memo, useCallback, useMemo } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMoneriumIban } from "@/module/monerium/hooks/useMoneriumIban";
import { useMoneriumOfframp } from "@/module/monerium/hooks/useMoneriumOfframp";
import styles from "./MoneriumOfframpForm.module.css";

type FormInput = {
    amount: string;
};

const TransactionStatus = memo(function TransactionStatus({
    isSuccess,
    isError,
    error,
    reset,
}: {
    isSuccess: boolean;
    isError: boolean;
    error: Error | null;
    reset: () => void;
}) {
    const { t } = useTranslation();

    if (isSuccess) {
        return (
            <div className={styles.moneriumOfframpForm__status}>
                <p className={styles.moneriumOfframpForm__statusText}>
                    {t("monerium.offramp.success")}
                </p>
            </div>
        );
    }

    if (isError && error) {
        return (
            <div className={styles.moneriumOfframpForm__status}>
                <p className={styles.moneriumOfframpForm__error}>
                    {error.message}
                </p>
                <Button onClick={reset} variant="secondary">
                    {t("monerium.offramp.tryAgain")}
                </Button>
            </div>
        );
    }

    return null;
});

export function MoneriumOfframpForm() {
    const { t } = useTranslation();
    const {
        iban,
        isLinkedToWallet,
        isLoading: isIbanLoading,
    } = useMoneriumIban();
    const { placeOrder, isPending, isSuccess, isError, error, reset } =
        useMoneriumOfframp();
    const { userBalance } = useGetUserBalance();

    const eureBalance = useMemo(() => {
        if (!userBalance?.balances) return 0;
        const eureToken = userBalance.balances.find((b) => b.symbol === "EURe");
        return eureToken?.amount ?? 0;
    }, [userBalance]);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<FormInput>({
        mode: "onChange",
        reValidateMode: "onChange",
    });

    const handleMaxClick = useCallback(() => {
        setValue("amount", eureBalance.toString(), {
            shouldValidate: true,
        });
    }, [eureBalance, setValue]);

    const onSubmit: SubmitHandler<FormInput> = useCallback(
        async (data) => {
            if (!iban) return;
            try {
                await placeOrder({ amount: data.amount, iban });
            } catch (err) {
                console.error("Offramp failed:", err);
            }
        },
        [iban, placeOrder]
    );

    if (isIbanLoading) {
        return (
            <div className={styles.moneriumOfframpForm__status}>
                <Spinner />
            </div>
        );
    }

    if (!iban) {
        return (
            <div className={styles.moneriumOfframpForm__status}>
                <p className={styles.moneriumOfframpForm__statusText}>
                    {t("monerium.offramp.noIban")}
                </p>
            </div>
        );
    }

    if (isSuccess || isError) {
        return (
            <TransactionStatus
                isSuccess={isSuccess}
                isError={isError}
                error={error}
                reset={reset}
            />
        );
    }

    if (isPending) {
        return (
            <div className={styles.moneriumOfframpForm__status}>
                <Spinner />
                <p className={styles.moneriumOfframpForm__statusText}>
                    {t("monerium.offramp.submitting")}
                </p>
                <p className={styles.moneriumOfframpForm__statusSubtext}>
                    {t("monerium.offramp.confirmBiometric")}
                </p>
            </div>
        );
    }

    return (
        <form
            className={styles.moneriumOfframpForm}
            onSubmit={handleSubmit(onSubmit)}
        >
            <div className={styles.moneriumOfframpForm__inputWrapper}>
                <label
                    htmlFor="amount"
                    className={styles.moneriumOfframpForm__label}
                >
                    <span>{t("monerium.offramp.amountLabel")}</span>
                    <span>
                        {t("monerium.offramp.balance")} {eureBalance}{" "}
                        <button
                            type="button"
                            onClick={handleMaxClick}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--color-primary)",
                                cursor: "pointer",
                                padding: 0,
                                font: "inherit",
                            }}
                        >
                            {t("monerium.offramp.max")}
                        </button>
                    </span>
                </label>
                <Input
                    type="number"
                    step="any"
                    id="amount"
                    aria-label="Amount to withdraw"
                    placeholder="0.00"
                    {...register("amount", {
                        required: t("monerium.offramp.amountRequired"),
                        validate: (value) => {
                            const num = Number.parseFloat(value);
                            if (Number.isNaN(num) || num <= 0) {
                                return t("monerium.offramp.amountInvalid");
                            }
                            if (num > eureBalance) {
                                return t(
                                    "monerium.offramp.insufficientBalance"
                                );
                            }
                            return true;
                        },
                    })}
                    aria-invalid={errors.amount ? "true" : "false"}
                />
                {errors.amount && (
                    <span className={styles.moneriumOfframpForm__error}>
                        {errors.amount.message}
                    </span>
                )}
            </div>

            <div className={styles.moneriumOfframpForm__inputWrapper}>
                <label
                    htmlFor="iban"
                    className={styles.moneriumOfframpForm__label}
                >
                    {t("monerium.offramp.destinationIban")}
                </label>
                <Input type="text" id="iban" value={iban} readOnly disabled />
                {!isLinkedToWallet && (
                    <div className={styles.moneriumOfframpForm__warning}>
                        {t("monerium.offramp.ibanWarning")}
                    </div>
                )}
            </div>

            <div className={styles.moneriumOfframpForm__bottom}>
                <Button
                    type="submit"
                    width="full"
                    disabled={isPending || !isLinkedToWallet}
                    loading={isPending}
                >
                    {t("monerium.offramp.submit")}
                </Button>
            </div>
        </form>
    );
}
