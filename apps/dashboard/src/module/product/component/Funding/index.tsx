"use client";

import { viemClient } from "@/context/blockchain/provider";
import { useAddProductBank } from "@/module/bank/hook/useAddProductBank";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useConvertToPreferredCurrency } from "@/module/common/hook/useConversionRate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { FormLayout } from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import { ProductHead } from "@/module/product/component/ProductHead";
import { useFundTestBank } from "@/module/product/hook/useFundTestBank";
import {
    type ProductBank,
    useGetProductFunding,
} from "@/module/product/hook/useGetProductFunding";
import { useSetBankDistributionStatus } from "@/module/product/hook/useSetBankDistributionStatus";
import { currencyOptions } from "@/module/product/utils/currencyOptions";
import { addresses, isRunningInProd } from "@frak-labs/app-essentials";
import { detectStablecoinFromToken } from "@frak-labs/app-essentials";
import {
    type Stablecoin,
    campaignBankAbi,
} from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Column, Columns } from "@frak-labs/ui/component/Columns";
import { IconInfo } from "@frak-labs/ui/component/IconInfo";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Switch } from "@frak-labs/ui/component/Switch";
import { Tooltip } from "@frak-labs/ui/component/Tooltip";
import { useMutation } from "@tanstack/react-query";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { BadgeCheck, CheckCircle, Plus, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    formatUnits,
    isAddressEqual,
} from "viem";
import { readContract } from "viem/actions";
import { useProductMetadata } from "../../hook/useProductMetadata";
import styles from "./index.module.css";

/**
 * Store product id locally
 */
const productIdAtom = atom<Hex | null>(null);

/**
 * Product funding page
 * @param productId
 * @returns
 */
export function ProductFunding({ productId }: { productId: Hex }) {
    const setProductId = useSetAtom(productIdAtom);
    const { data, isLoading, isPending } = useGetProductFunding({ productId });

    useEffect(() => setProductId(productId), [productId, setProductId]);

    return (
        <FormLayout>
            <ProductHead productId={productId} />
            {isLoading || isPending ? (
                <Spinner />
            ) : (
                <ProductFundingBanks banks={data ?? []} productId={productId} />
            )}
        </FormLayout>
    );
}

/**
 * List of banks for the product
 * @param banks
 * @returns
 */
function ProductFundingBanks({
    banks,
    productId,
}: { banks: ProductBank[]; productId: Hex }) {
    if (banks.length === 0 || !productId) {
        return <div>No banks</div>;
    }

    return (
        <>
            {banks.map((bank) => (
                <ProductFundingBank
                    key={`bank-${bank.address}`}
                    bank={bank}
                    productId={productId}
                />
            ))}
            <AddNewBank banks={banks} productId={productId} />
        </>
    );
}

/**
 * Inline fund action for the actions row
 * @returns
 */
function FundAction({
    bank,
    isTestBank,
    productId,
}: { bank: ProductBank; isTestBank: boolean; productId: Hex }) {
    const { mutate: fundTestBank, isPending } = useFundTestBank();
    const { data: productMetadata, isLoading: isLoadingProductMetadata } =
        useProductMetadata({ productId });
    const isShopify = useMemo(
        () => productMetadata?.domain?.includes("myshopify") ?? false,
        [productMetadata]
    );

    const stablecoin = useMemo(() => {
        return detectStablecoinFromToken(bank.token.address);
    }, [bank.token.address]);

    if (isLoadingProductMetadata) {
        return <Spinner />;
    }

    if (isShopify) {
        return (
            <Link
                href={`https://admin.shopify.com/store/${productMetadata?.domain?.replace(".myshopify.com", "")}/apps/frak/app/status`}
                target="_blank"
            >
                Add funds
            </Link>
        );
    }

    if (isTestBank) {
        return (
            <Button
                variant={"submit"}
                disabled={isPending}
                isLoading={isPending}
                onClick={() => fundTestBank({ bank: bank.address })}
            >
                Add funds
            </Button>
        );
    }

    // For Monerium stablecoins in dev/testnet only, use the test funding
    if (!isRunningInProd && stablecoin && stablecoin !== "usdc") {
        return (
            <Button
                variant={"submit"}
                disabled={isPending}
                isLoading={isPending}
                onClick={() => fundTestBank({ bank: bank.address, stablecoin })}
            >
                Add funds
            </Button>
        );
    }

    return (
        <Link href={process.env.FUNDING_ON_RAMP_URL ?? ""} target={"_blank"}>
            Add funds
        </Link>
    );
}

/**
 * Bank information
 * @param bank
 * @returns
 */
function ProductFundingBank({
    bank,
    productId,
}: { bank: ProductBank; productId: Hex }) {
    const isTestBank = useMemo(
        () => isAddressEqual(bank.token.address, addresses.mUSDToken),
        [bank.token.address]
    );

    const stablecoinInfo = useMemo(() => {
        const symbol = bank.token.symbol.toLowerCase();
        for (const group of currencyOptions) {
            const option = group.options.find(
                (opt) =>
                    opt.label.toLowerCase() === symbol || opt.value === symbol
            );
            if (option) {
                return {
                    group: group.group,
                    label: option.label,
                    value: option.value,
                };
            }
        }
        return null;
    }, [bank.token.symbol]);

    const panelTitle = stablecoinInfo
        ? `${stablecoinInfo.label} Bank`
        : `${bank.token.symbol} Bank`;

    return (
        <Panel className={styles.bankPanel}>
            <div className={styles.bankContent}>
                {/* Row 1: Title and badges */}
                <div className={styles.bankRow}>
                    <Title
                        as={"h3"}
                        size={"small"}
                        icon={<BadgeCheck color={"#0DDB84"} />}
                    >
                        {panelTitle}
                    </Title>
                    <div className={styles.bankHeader}>
                        {stablecoinInfo && (
                            <Badge size={"small"} variant={"information"}>
                                {stablecoinInfo.group}
                            </Badge>
                        )}
                        {isTestBank && (
                            <Badge size={"small"} variant={"warning"}>
                                Test
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Row 2: Balance and Status columns */}
                <div className={styles.bankRow}>
                    <Columns align="start">
                        <Column className={styles.balanceColumn}>
                            <div className={styles.bankSection}>
                                <Title
                                    as={"h4"}
                                    size={"small"}
                                    className={styles.bankSectionTitle}
                                >
                                    Balance information
                                </Title>
                                <BankAmount
                                    title="Balance:"
                                    balance={bank.balance}
                                    symbol={bank.token.symbol}
                                    decimals={bank.token.decimals}
                                    token={bank.token.address}
                                />
                                <BankAmount
                                    title="Total distributed:"
                                    balance={bank.totalDistributed}
                                    symbol={bank.token.symbol}
                                    decimals={bank.token.decimals}
                                    token={bank.token.address}
                                />
                                <BankAmount
                                    title="Total claimed:"
                                    balance={bank.totalClaimed}
                                    symbol={bank.token.symbol}
                                    decimals={bank.token.decimals}
                                    token={bank.token.address}
                                />
                            </div>
                        </Column>
                        <Column justify={"start"}>
                            <div className={styles.bankSection}>
                                <Title
                                    as={"h4"}
                                    size={"small"}
                                    className={styles.bankSectionTitle}
                                >
                                    Campaigns funding status
                                </Title>
                                <Row align={"center"}>
                                    <ToggleFundingStatus bank={bank} />
                                    <Badge
                                        size={"small"}
                                        variant={
                                            bank.isDistributing
                                                ? "success"
                                                : "danger"
                                        }
                                    >
                                        {bank.isDistributing ? (
                                            <CheckCircle size={16} />
                                        ) : (
                                            <XCircle size={16} />
                                        )}
                                        {bank.isDistributing
                                            ? "Active"
                                            : "Inactive"}
                                    </Badge>
                                    <StatusTooltip />
                                </Row>
                            </div>
                        </Column>
                    </Columns>
                </div>

                {/* Row 3: Actions */}
                <div className={styles.bankRow}>
                    <div className={styles.bankActions}>
                        <FundAction
                            bank={bank}
                            isTestBank={isTestBank}
                            productId={productId}
                        />
                        <WithdrawFunds bank={bank} />
                    </div>
                </div>
            </div>
        </Panel>
    );
}

/**
 * Show the amount of the bank
 * @param title
 * @param amount
 * @param symbol
 * @returns
 */
function BankAmount({
    title,
    balance,
    symbol,
    decimals,
    token,
}: {
    title: string;
    balance: bigint;
    symbol: string;
    decimals: number;
    token: Address;
}) {
    const converted = useConvertToPreferredCurrency({
        balance,
        decimals,
        token,
    });

    // Format the raw balance
    const formattedBalance = formatUnits(balance, decimals);
    const formattedPrice = formatPrice(formattedBalance);

    // If conversion failed but we have a balance, show the raw amount
    if (converted === undefined && balance >= 0n) {
        return (
            <p>
                {title}{" "}
                <strong>{formattedPrice?.replace("$", `${symbol} `)}</strong>
            </p>
        );
    }

    // If we have a converted value, show both
    if (converted !== undefined) {
        return (
            <p>
                {title} <strong>{converted}</strong> (
                {formattedPrice?.replace("$", `${symbol} `)})
            </p>
        );
    }

    // Otherwise don't show anything
    return null;
}

/**
 * Toggle the funding status of the bank
 * @param bank
 * @returns
 */
function ToggleFundingStatus({ bank }: { bank: ProductBank }) {
    const productId = useAtomValue(productIdAtom);

    const { isSettingDistributionStatus, setDistributionStatus } =
        useSetBankDistributionStatus({
            productId: productId ?? "0x0",
            bank: bank.address,
        });

    return (
        <>
            <Switch
                disabled={isSettingDistributionStatus}
                checked={bank.isDistributing}
                onCheckedChange={(checked) =>
                    setDistributionStatus({ isDistributing: checked })
                }
            />
            {isSettingDistributionStatus && <Spinner />}
        </>
    );
}

/**
 * Funding status tooltip
 * @returns
 */
function StatusTooltip() {
    return (
        <Tooltip
            content={
                "When active, the bank will distribute the funds to the campaigns."
            }
        >
            <IconInfo />
        </Tooltip>
    );
}

/**
 * Withdraw funds from the bank
 */
function WithdrawFunds({ bank }: { bank: ProductBank }) {
    const { mutateAsync: sendTx } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    const { mutate: withdraw, isPending: isWithdrawing } = useMutation({
        mutationKey: ["product", "funding", "withdraw", bank.address],
        mutationFn: async () => {
            // Check if the bank is currently distributing
            const isDistributing = await readContract(viemClient, {
                abi: campaignBankAbi,
                address: bank.address,
                functionName: "isDistributionEnabled",
            });

            const txDatas: Hex[] = [];

            // If distributing tokens, disable distribution first
            if (isDistributing) {
                txDatas.push(
                    encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "updateDistributionState",
                        args: [false],
                    })
                );
            }

            // Withdraw funds tx hash
            txDatas.push(
                encodeFunctionData({
                    abi: campaignBankAbi,
                    functionName: "withdraw",
                })
            );

            // Send the transaction
            const { hash } = await sendTx({
                tx: txDatas.map((data) => ({
                    to: bank.address,
                    data,
                })),
            });

            // Invalidate product related queries
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["product"],
                // Long confirmations time to ensure indexer is up to date
                confirmations: 32,
            });
        },
    });

    return (
        <Button
            variant={"submit"}
            onClick={() => withdraw()}
            isLoading={isWithdrawing}
            disabled={isWithdrawing}
        >
            Withdraw funds
        </Button>
    );
}

/**
 * Add new bank component
 */
function AddNewBank({
    banks,
    productId,
}: { banks: ProductBank[]; productId: Hex }) {
    const [isAdding, setIsAdding] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState<string>("");
    const { mutate: addBank, isPending } = useAddProductBank();

    const usedCurrencies = useMemo(() => {
        return banks
            .map((bank) => detectStablecoinFromToken(bank.token.address))
            .filter((value) => value !== undefined);
    }, [banks]);

    const availableCurrencies = useMemo(() => {
        return currencyOptions
            .reduce<
                Array<{
                    value: Stablecoin;
                    label: string;
                    group: string;
                    description: string;
                }>
            >((acc, group) => {
                acc.push(
                    ...group.options.map((option) => ({
                        ...option,
                        group: group.group,
                        description: group.description,
                    }))
                );
                return acc;
            }, [])
            .filter((option) => !usedCurrencies.includes(option.value));
    }, [usedCurrencies]);

    const handleAddBank = () => {
        if (!selectedCurrency || !productId) return;

        addBank(
            {
                productId,
                stablecoin: selectedCurrency as Stablecoin,
            },
            {
                onSuccess: () => {
                    setIsAdding(false);
                    setSelectedCurrency("");
                },
            }
        );
    };

    if (availableCurrencies.length === 0) {
        return null;
    }

    if (!isAdding) {
        return (
            <Button
                variant="outline"
                onClick={() => setIsAdding(true)}
                className={styles.addBankButton}
            >
                <Plus size={16} />
                Add new bank
            </Button>
        );
    }

    return (
        <Panel title="Add new bank" className={styles.bankPanel}>
            <p>Select a stablecoin for the new bank:</p>
            <RadioGroup
                value={selectedCurrency}
                onValueChange={setSelectedCurrency}
                className={styles.currencySelection}
            >
                {availableCurrencies.map((currency) => (
                    <label
                        key={currency.value}
                        htmlFor={`currency-${currency.value}`}
                        className={styles.currencyOption}
                    >
                        <RadioGroupItem
                            id={`currency-${currency.value}`}
                            value={currency.value}
                        />
                        <div>
                            <strong>
                                {currency.label} ({currency.group})
                            </strong>
                            <p>{currency.description}</p>
                        </div>
                    </label>
                ))}
            </RadioGroup>
            <div className={styles.bankActions}>
                <Button
                    variant="submit"
                    onClick={handleAddBank}
                    disabled={!selectedCurrency || isPending}
                    isLoading={isPending}
                >
                    Create bank
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        setIsAdding(false);
                        setSelectedCurrency("");
                    }}
                >
                    Cancel
                </Button>
            </div>
        </Panel>
    );
}
