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
import { addresses } from "@frak-labs/app-essentials";
import { Switch } from "@frak-labs/nexus-wallet/src/module/common/component/Switch";
import { Button } from "@module/component/Button";
import { Column, Columns } from "@module/component/Columns";
import { Spinner } from "@module/component/Spinner";
import { CheckCircle, XCircle } from "lucide-react";
import { type Hex, isAddressEqual } from "viem";
import styles from "./index.module.css";

export function ProductFunding({ productId }: { productId: Hex }) {
    const { data, isLoading, isPending } = useGetProductFunding({ productId });

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

function ProductFundingBanks({ banks }: { banks: ProductBank[] }) {
    if (banks.length === 0) {
        return <div>No banks</div>;
    }

    return banks.map((bank) => (
        <ProductFundingBank key={`bank-${bank.address}`} bank={bank} />
    ));
}

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
                        <Switch
                            // checked={!!sessionStatus}
                            onCheckedChange={(checked) => {
                                console.log(checked);
                            }}
                        />
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
    return (
        <p>
            {title} <strong>{formatPrice(amount, undefined, "EUR")}</strong> (
            {formatPrice(amount)?.replace("$", `${symbol} `)})
        </p>
    );
}

/**
 * Fund the balance of the bank
 * @param bank
 * @returns
 */
function FundBalance({ bank }: { bank: ProductBank }) {
    const { mutate, isPending } = useFundBank();

    return (
        <Columns>
            <Column>
                <p>
                    <Button
                        variant={"submit"}
                        disabled={isPending}
                        isLoading={isPending}
                        onClick={() => mutate({ bank: bank.token.address })}
                    >
                        Fund Balance
                    </Button>
                </p>
            </Column>
        </Columns>
    );
}
