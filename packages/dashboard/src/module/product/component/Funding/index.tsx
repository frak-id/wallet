"use client";

import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import {
    type ProductBank,
    useGetProductFunding,
} from "@/module/product/hook/useGetProductFunding";
import { Column, Columns } from "@module/component/Columns";
import { Spinner } from "@module/component/Spinner";
import { CheckCircle, XCircle } from "lucide-react";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function ProductFunding({ productId }: { productId: Hex }) {
    const { data, isLoading } = useGetProductFunding({ productId });

    return (
        <Panel title={"Funding of the product"}>
            {isLoading ? (
                <Spinner />
            ) : (
                <ProductFundingBanks banks={data ?? []} />
            )}
        </Panel>
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
    // todo: UI
    // todo: Button to switch bank distribution status (with warning when toggled off, if off it mean that no campaign can distribute this token for this plateform)
    // todo: Button to request test token if token.address = musdToken

    return (
        <div className={styles.productFundingBank}>
            <Title as={"h3"} size={"small"}>
                {bank.token.name} ({bank.token.symbol}){" "}
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
            </Title>
            <Columns className={styles.productFundingBank__columns}>
                <Column size={"none"}>
                    Balance
                    <br />
                    {bank.formatted.balance}
                    {bank.token.symbol}
                </Column>
                <Column size={"none"}>
                    Total distributed
                    <br />
                    {bank.formatted.totalDistributed}
                </Column>
                <Column size={"none"}>
                    Total claimed
                    <br />
                    {bank.formatted.totalClaimed}
                </Column>
            </Columns>
        </div>
    );
}
