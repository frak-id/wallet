"use client";

import { viemClient } from "@/context/blockchain/provider";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useConvertToPreferredCurrency } from "@/module/common/hook/useConversionRate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import { useFundTestBank } from "@/module/product/hook/useFundTestBank";
import {
    type ProductBank,
    useGetProductFunding,
} from "@/module/product/hook/useGetProductFunding";
import { useSetBankDistributionStatus } from "@/module/product/hook/useSetBankDistributionStatus";
import { addresses } from "@frak-labs/app-essentials";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { Button } from "@shared/module/component/Button";
import { Column, Columns } from "@shared/module/component/Columns";
import { IconInfo } from "@shared/module/component/IconInfo";
import { Spinner } from "@shared/module/component/Spinner";
import { Switch } from "@shared/module/component/Switch";
import { Tooltip } from "@shared/module/component/Tooltip";
import { useMutation } from "@tanstack/react-query";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    formatUnits,
    isAddressEqual,
} from "viem";
import { readContract } from "viem/actions";
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
            <Panel title={"Manage the product balance"}>
                {isLoading || isPending ? (
                    <Spinner />
                ) : (
                    <ProductFundingBanks banks={data ?? []} />
                )}
            </Panel>
        </FormLayout>
    );
}

/**
 * List of banks for the product
 * @param banks
 * @returns
 */
function ProductFundingBanks({ banks }: { banks: ProductBank[] }) {
    const productId = useAtomValue(productIdAtom);

    if (banks.length === 0 || !productId) {
        return <div>No banks</div>;
    }

    return banks.map((bank) => (
        <ProductFundingBank key={`bank-${bank.address}`} bank={bank} />
    ));
}

/**
 * Bank information
 * @param bank
 * @returns
 */
function ProductFundingBank({ bank }: { bank: ProductBank }) {
    const isTestBank = useMemo(
        () => isAddressEqual(bank.token.address, addresses.mUSDToken),
        [bank.token.address]
    );

    return (
        <div className={styles.productFundingBank}>
            <Columns>
                <Column>
                    <Title
                        as={"h3"}
                        size={"small"}
                        className={styles.productFundingBank__title}
                    >
                        {isTestBank && (
                            <Badge size={"small"} variant={"warning"}>
                                Test
                            </Badge>
                        )}
                        Campaigns funding status
                    </Title>
                    <Row align={"center"}>
                        <ToggleFundingStatus bank={bank} />
                        <Badge
                            size={"small"}
                            variant={bank.isDistributing ? "success" : "danger"}
                        >
                            {bank.isDistributing ? (
                                <CheckCircle size={16} />
                            ) : (
                                <XCircle size={16} />
                            )}
                            {bank.isDistributing ? "Active" : "Inactive"}
                        </Badge>
                        <StatusTooltip />
                    </Row>
                </Column>
            </Columns>
            <Columns>
                <Column>
                    <Title
                        as={"h3"}
                        size={"small"}
                        className={styles.productFundingBank__title}
                    >
                        Balance informations
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
                </Column>
            </Columns>
            <FundBalance bank={bank} isTestBank={isTestBank} />
            <br />
            <WithdrawFunds bank={bank} />
        </div>
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
    if (converted === undefined) return null;
    return (
        <p>
            {title} <strong>{converted}</strong> (
            {formatPrice(formatUnits(balance, decimals))?.replace(
                "$",
                `${symbol} `
            )}
            )
        </p>
    );
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
 * Fund the balance of the bank
 * @returns
 */
function FundBalance({
    bank,
    isTestBank,
}: { bank: ProductBank; isTestBank: boolean }) {
    const { mutate: fundTestBank, isPending } = useFundTestBank();

    if (isTestBank) {
        return (
            <Columns>
                <Column>
                    <p>
                        <Button
                            variant={"submit"}
                            disabled={isPending}
                            isLoading={isPending}
                            onClick={() => fundTestBank({ bank: bank.address })}
                        >
                            Add funds
                        </Button>
                    </p>
                </Column>
            </Columns>
        );
    }

    return (
        <Columns>
            <Column>
                <p>
                    <Link
                        href={process.env.FUNDING_ON_RAMP_URL ?? ""}
                        target={"_blank"}
                    >
                        Add funds
                    </Link>
                </p>
            </Column>
        </Columns>
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
