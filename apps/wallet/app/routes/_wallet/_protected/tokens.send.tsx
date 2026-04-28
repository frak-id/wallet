import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
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
import { FieldError, FieldLabel } from "@/module/common/component/Field";
import { Title } from "@/module/common/component/Title";
import { TokenMax } from "@/module/tokens/component/TokenMax";
import { TokenModalList } from "@/module/tokens/component/TokenModalList";
import { TransactionError } from "@/module/tokens/component/TransactionError";
import { TransactionSuccess } from "@/module/tokens/component/TransactionSuccess";
import { getUpdatedToken } from "@/module/tokens/utils/getUpdatedToken";
import { validateAmount } from "@/module/tokens/utils/validateAmount";
import * as styles from "./tokens.send.css";

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
        <Stack space="xs">
            <FieldLabel>{t("common.to")}</FieldLabel>
            <Input
                variant="bare"
                length="big"
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
                <FieldError>{errors.toAddress.message}</FieldError>
            )}
        </Stack>
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
        <Stack space="xs">
            <Inline
                space="m"
                alignY="center"
                align="space-between"
                wrap={false}
            >
                <FieldLabel>
                    {t("common.balance")}: {selectedToken.amount}
                </FieldLabel>
                <TokenMax onClick={handleMaxClick} />
            </Inline>
            <Input
                variant="bare"
                length="big"
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
            {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
        </Stack>
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

    const onSubmit: SubmitHandler<FormInput> = useCallback(
        async (data) => {
            if (!selectedToken) return;
            const tokenSymbol = selectedToken.symbol ?? "unknown";

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
                flowRef.current?.end("succeeded", {
                    token_symbol: tokenSymbol,
                    amount_bucket: bucketAmount(amount),
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

    return (
        <Box className={styles.pageContainer}>
            <Stack space="m">
                <Back href={"/wallet"} />
                <Title size="page">{t("wallet.tokens.sendTitle")}</Title>
            </Stack>

            <Box
                as="form"
                onSubmit={handleSubmit(onSubmit)}
                display={"flex"}
                flexDirection={"column"}
                justifyContent={"space-between"}
                gap={"l"}
                flexGrow={1}
                paddingTop={"m"}
            >
                <Stack space="l">
                    <AddressInput register={register} errors={errors} />

                    {selectedToken && (
                        <AmountInput
                            register={register}
                            errors={errors}
                            selectedToken={selectedToken}
                            setValue={setValue}
                            setSelectedToken={setSelectedToken}
                            resetField={resetField}
                        />
                    )}

                    <TransactionStatus
                        isSuccess={isSuccess}
                        isError={isError}
                        hash={hash}
                        error={error}
                    />
                </Stack>

                {selectedToken && (
                    <Button
                        type={"submit"}
                        disabled={isPending || isConfirming}
                    >
                        {t("common.send")}
                    </Button>
                )}
            </Box>
        </Box>
    );
}

function bucketAmount(raw: string): TokensSendAmountBucket {
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 1) return "<1";
    if (n < 10) return "1-10";
    if (n < 100) return "10-100";
    return ">100";
}
