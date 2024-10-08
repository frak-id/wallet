"use client";

import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { FormLayout } from "@/module/forms/Form";
import { ProductHead } from "@/module/product/component/ProductHead";
import { useFundBank } from "@/module/product/hook/useFundBank";
import {
    type ProductBank,
    useGetProductFunding,
} from "@/module/product/hook/useGetProductFunding";
import { useSetBankDistributionStatus } from "@/module/product/hook/useSetBankDistributionStatus";
import { addresses } from "@frak-labs/app-essentials";
import { Switch } from "@frak-labs/nexus-wallet/src/module/common/component/Switch";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { IconInfo } from "@module/component/IconInfo";
import { Spinner } from "@module/component/Spinner";
import { Tooltip } from "@module/component/Tooltip";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { CheckCircle, XCircle } from "lucide-react";
import { useEffect } from "react";
import { type Hex, isAddressEqual } from "viem";
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
 * Bank informations
 * @param bank
 * @returns
 */
function ProductFundingBank({ bank }: { bank: ProductBank }) {
    return (
        <div className={styles.productFundingBank}>
            <Columns>
                <Column>
                    <Title
                        as={"h3"}
                        size={"small"}
                        className={styles.productFundingBank__title}
                    >
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
                        amount={bank.formatted.balance}
                        symbol={bank.token.symbol}
                    />
                    <BankAmount
                        title="Total distributed:"
                        amount={bank.formatted.totalDistributed}
                        symbol={bank.token.symbol}
                    />
                    <BankAmount
                        title="Total claimed:"
                        amount={bank.formatted.totalClaimed}
                        symbol={bank.token.symbol}
                    />
                </Column>
            </Columns>
            {isAddressEqual(bank.token.address, addresses.mUSDToken) && (
                <FundBalance bank={bank} />
            )}
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
    amount,
    symbol,
}: { title: string; amount: string; symbol: string }) {
    const amountInEuros = Number.parseFloat(amount) * 0.91; // Assuming 1 USD = 0.91 EUR
    const formattedEuros = formatPrice(
        amountInEuros.toString(),
        undefined,
        "EUR"
    );
    return (
        <p>
            {title} <strong>{formattedEuros}</strong> (
            {formatPrice(amount)?.replace("$", `${symbol} `)})
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

    const { canUpdate, isSettingDistributionStatus, setDistributionStatus } =
        useSetBankDistributionStatus({
            productId: productId ?? "0x0",
            bank: bank.address,
        });

    if (!canUpdate) return null;

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
 * @param bank
 * @returns
 */
function FundBalance({ bank }: { bank: ProductBank }) {
    const { mutate: fundBank, isPending } = useFundBank();

    return (
        <Columns>
            <Column>
                <p>
                    <Button
                        variant={"submit"}
                        disabled={isPending}
                        isLoading={isPending}
                        onClick={() => fundBank({ bank: bank.address })}
                    >
                        Fund Balance
                    </Button>
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
