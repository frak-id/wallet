import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { useConvertToPreferredCurrency } from "@/module/common/hook/useConversionRate";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import {
    type ProductBank,
    useGetProductFunding,
} from "@/module/product/hook/useGetProductFunding";
import { currencyOptions } from "@/module/product/utils/currencyOptions";
import type { Campaign } from "@/types/Campaign";
import { useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { toHex } from "viem";

export function FormBank() {
    const { watch, setValue, control } = useFormContext<Campaign>();
    const productId = watch("productId");
    const selectedBankAddress = watch("bank");

    const { data, isLoading } = useGetProductFunding({
        productId: productId !== "" ? toHex(BigInt(productId)) : undefined,
    });
    const isDisabled = isLoading || !data || data.length === 0;

    const selectedBank = useMemo(() => {
        if (!data || !selectedBankAddress) return null;
        return (
            data.find((bank) => bank.address === selectedBankAddress) || null
        );
    }, [data, selectedBankAddress]);

    // Small hook to auto select a bank if there is only one
    useEffect(() => {
        if (!data) return;
        if (data.length === 0) return;
        if (data.length > 1) return;

        setValue("bank", data[0].address);
    }, [data, setValue]);

    return (
        <Panel title="Funding bank" aria-disabled={isDisabled}>
            <FormField
                control={control}
                name="bank"
                rules={{ required: "Select a bank" }}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Select
                                name={field.name}
                                onValueChange={(value) => {
                                    if (value === "") return;
                                    field.onChange(value);
                                }}
                                value={field.value}
                                disabled={isDisabled}
                            >
                                <SelectTrigger length={"medium"} {...field}>
                                    <SelectValue placeholder="Select a bank">
                                        {selectedBank && (
                                            <SelectedBankDisplay
                                                bank={selectedBank}
                                            />
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {(data ?? []).map((bank) => (
                                        <SelectItemBank
                                            key={bank.address}
                                            bank={bank}
                                        />
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}

function SelectItemBank({ bank }: { bank: ProductBank }) {
    const formattedBalance = useConvertToPreferredCurrency({
        token: bank.token.address,
        balance: bank.balance,
        decimals: bank.token.decimals,
    });

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
                    description: group.description,
                };
            }
        }
        return null;
    }, [bank.token.symbol]);

    return (
        <SelectItem key={bank.address} value={bank.address}>
            <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <span>
                        {stablecoinInfo
                            ? stablecoinInfo.label
                            : bank.token.symbol}
                    </span>
                    {stablecoinInfo && (
                        <Badge size="small" variant="information">
                            {stablecoinInfo.group}
                        </Badge>
                    )}
                    {formattedBalance && (
                        <span
                            style={{
                                color: "var(--color-text-secondary)",
                                fontSize: "0.875rem",
                            }}
                        >
                            Balance: {formattedBalance}
                        </span>
                    )}
                </div>
                {stablecoinInfo && (
                    <span
                        style={{
                            fontSize: "0.75rem",
                            color: "var(--color-text-secondary)",
                        }}
                    >
                        {stablecoinInfo.description}
                    </span>
                )}
            </div>
        </SelectItem>
    );
}

function SelectedBankDisplay({ bank }: { bank: ProductBank }) {
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

    const formattedBalance = useConvertToPreferredCurrency({
        token: bank.token.address,
        balance: bank.balance,
        decimals: bank.token.decimals,
    });

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>
                {stablecoinInfo ? stablecoinInfo.label : bank.token.symbol}
            </span>
            {stablecoinInfo && (
                <Badge size="small" variant="information">
                    {stablecoinInfo.group}
                </Badge>
            )}
            {formattedBalance && (
                <span
                    style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "0.875rem",
                    }}
                >
                    {formattedBalance}
                </span>
            )}
        </div>
    );
}
