"use client";
import { Panel } from "@/module/common/component/Panel";
import {
    type ProductBank,
    useGetProductFunding,
} from "@/module/product/hook/useGetProductFunding";
import { Spinner } from "@module/component/Spinner";
import type { Hex } from "viem";

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

    return (
        <div>
            {banks.map((bank, index) => (
                <>
                    Bank {index + 1}
                    <ProductFundingBank
                        bank={bank}
                        key={`bank-${bank.address}`}
                    />
                </>
            ))}
        </div>
    );
}

function ProductFundingBank({ bank }: { bank: ProductBank }) {
    // todo: UI
    // todo: Button to switch bank distribution status (with warning when toggled off, if off it mean that no campaign can distribute this token for this plateform)
    // todo: Button to request test token if token.address = musdToken

    return (
        <div>
            <div>
                Token: {bank.token.name} ({bank.token.symbol})
            </div>
            <div>
                Balance: {bank.formatted.balance}
                {bank.token.symbol}
            </div>
            <div>Total distributed: {bank.formatted.totalDistributed}</div>
            <div>Total claimed: {bank.formatted.totalClaimed}</div>
            <div>Is active? {bank.isDistributing.toString()}</div>
        </div>
    );
}
