import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Input } from "@frak-labs/design-system/components/Input";
import { Text } from "@frak-labs/design-system/components/Text";
import type {
    BalanceItem,
    Flow,
    TokensSendAmountBucket,
} from "@frak-labs/wallet-shared";
import { startFlow, useGetUserBalance } from "@frak-labs/wallet-shared";
import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
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
import { useBiometricConfirm } from "@/module/biometrics";
import { Back } from "@/module/common/component/Back";
import { TokenMax } from "@/module/tokens/component/TokenMax";
import { TokenModalList } from "@/module/tokens/component/TokenModalList";
import { TransactionError } from "@/module/tokens/component/TransactionError";
import { TransactionSuccess } from "@/module/tokens/component/TransactionSuccess";
import { getUpdatedToken } from "@/module/tokens/utils/getUpdatedToken";
import { validateAmount } from "@/module/tokens/utils/validateAmount";

type SendSearchParams = {
    to?: string;
};

export const Route = createFileRoute("/_wallet/_protected/tokens/send")({
    component: TokensSendPage,
    validateSearch: (search: Record<string, unknown>): SendSearchParams => ({
        to: typeof search.to === "string" ? search.to : undefined,
    }),
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
        <Box display={"flex"} flexDirection={"column"} gap={"xs"}>
            <Text variant="label" color="secondary">
                {t("common.to")}
            </Text>
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
                <Text variant="caption" color="error">
                    {errors.toAddress.message}
                </Text>
            )}
        </Box>
    );
};

const AmountInput = function AmountInput({
    register,
    errors,
    selectedToken,
    setValue,
    setSelectedToken,
    resetField,
    onTokenChanged,
    onMaxClicked,
}: {
    register: UseFormRegister<FormInput>;
    errors: FieldErrors<FormInput>;
    selectedToken: BalanceItem;
    setValue: UseFormSetValue<FormInput>;
    setSelectedToken: (token: BalanceItem) => void;
    resetField: UseFormResetField<FormInput>;
    onTokenChanged: (token_symbol: string) => void;
    onMaxClicked: (token_symbol: string) => void;
}) {
    const { t } = useTranslation();

    const handleMaxClick = useCallback(() => {
        onMaxClicked(selectedToken?.symbol ?? "unknown");
        setValue("amount", selectedToken?.amount.toString(), {
            shouldValidate: true,
        });
    }, [selectedToken, setValue, onMaxClicked]);

    const handleTokenChange = useCallback(
        (token: BalanceItem) => {
            onTokenChanged(token.symbol ?? "unknown");
            setSelectedToken(token);
            resetField("amount");
        },
        [setSelectedToken, resetField, onTokenChanged]
    );

    return (
        <Box display={"flex"} flexDirection={"column"} gap={"xs"}>
            <Box
                display={"flex"}
                alignItems={"center"}
                justifyContent={"space-between"}
            >
                <Text variant="label" color="secondary">
                    {t("common.balance")}: {selectedToken.amount}
                </Text>
                <TokenMax onClick={handleMaxClick} />
            </Box>
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
                <Text variant="caption" color="error">
                    {errors.amount.message}
                </Text>
            )}
        </Box>
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
    const { to: prefillAddress } = Route.useSearch();
    const flowRef = useRef<Flow | null>(null);

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

    useEffect(() => {
        if (prefillAddress) {
            setValue("toAddress", prefillAddress as Hex);
        }
    }, [prefillAddress, setValue]);

    const { userBalance, refetch } = useGetUserBalance();

    const [selectedToken, setSelectedToken] = useState<
        BalanceItem | undefined
    >();

    const {
        mutateAsync: writeContractAsync,
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

    // Open the send flow on mount; end as "abandoned" on unmount if the user
    // never submitted. Merchant/prefill context rides on tokens_send_started.
    useEffect(() => {
        const flow = startFlow("tokens_send", {
            prefill_address: Boolean(prefillAddress),
        });
        flowRef.current = flow;
        return () => {
            if (!flow.ended) flow.end("abandoned");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Validation errors — emit once per error type, not on every keystroke
    const reportedAddressError = useRef<string | null>(null);
    useEffect(() => {
        const errType = errors.toAddress?.type ?? null;
        if (errType && errType !== reportedAddressError.current) {
            reportedAddressError.current = errType;
            flowRef.current?.track("tokens_send_validation_failed", {
                field: "address",
                error_type: errType,
            });
        } else if (!errType) {
            reportedAddressError.current = null;
        }
    }, [errors.toAddress]);

    const reportedAmountError = useRef<string | null>(null);
    useEffect(() => {
        const errType = errors.amount?.type ?? null;
        if (errType && errType !== reportedAmountError.current) {
            reportedAmountError.current = errType;
            flowRef.current?.track("tokens_send_validation_failed", {
                field: "amount",
                error_type: errType,
            });
        } else if (!errType) {
            reportedAmountError.current = null;
        }
    }, [errors.amount]);

    const onSubmit: SubmitHandler<FormInput> = useCallback(
        async (data) => {
            if (!selectedToken) return;
            const tokenSymbol = selectedToken.symbol ?? "unknown";

            flowRef.current?.track("tokens_send_biometric_requested");
            const confirmed = await confirm();
            if (!confirmed) {
                flowRef.current?.track("tokens_send_biometric_rejected");
                return;
            }

            const { toAddress, amount } = data;
            const amount_bucket = bucketAmount(amount);
            flowRef.current?.track("tokens_send_submitted", {
                token_symbol: tokenSymbol,
                amount_bucket,
            });
            const _startedAt = Date.now();

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
                flowRef.current?.end("succeeded", {
                    token_symbol: tokenSymbol,
                });

                reset();
                await refetch();
            } catch (err) {
                const error_message =
                    err instanceof Error ? err.message : String(err);
                const error_type = err instanceof Error ? err.name : undefined;
                flowRef.current?.end("failed", {
                    token_symbol: tokenSymbol,
                    error_type,
                    error_message,
                });
                console.error("Transaction failed:", err);
            }
        },
        [selectedToken, writeContractAsync, reset, refetch, confirm]
    );

    const handleTokenChanged = useCallback((token_symbol: string) => {
        flowRef.current?.track("tokens_send_token_changed", { token_symbol });
    }, []);

    const handleMaxClicked = useCallback((token_symbol: string) => {
        flowRef.current?.track("tokens_send_max_clicked", { token_symbol });
    }, []);

    return (
        <>
            <Back href={"/wallet"}>{t("wallet.tokens.backToWallet")}</Back>
            <form onSubmit={handleSubmit(onSubmit)}>
                <Box
                    display={"flex"}
                    flexDirection={"column"}
                    gap={"l"}
                    paddingTop={"m"}
                >
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
                                onTokenChanged={handleTokenChanged}
                                onMaxClicked={handleMaxClicked}
                            />

                            <Button
                                type={"submit"}
                                disabled={isPending || isConfirming}
                            >
                                {t("common.send")}
                            </Button>

                            <TransactionStatus
                                isSuccess={isSuccess}
                                isError={isError}
                                hash={hash}
                                error={error}
                            />
                        </>
                    )}
                </Box>
            </form>
        </>
    );
}

function bucketAmount(raw: string): TokensSendAmountBucket {
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 1) return "<1";
    if (n < 10) return "1-10";
    if (n < 100) return "10-100";
    return ">100";
}
