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
import type { Campaign } from "@/types/Campaign";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { toHex } from "viem";

export function FormBank() {
    const { watch, setValue, control } = useFormContext<Campaign>();
    const productId = watch("productId");

    const { data, isLoading } = useGetProductFunding({
        productId: productId !== "" ? toHex(BigInt(productId)) : undefined,
    });
    const isDisabled = isLoading || !data || data.length === 0;

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
                                    <SelectValue placeholder="Select a bank" />
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
    return (
        <SelectItem key={bank.address} value={bank.address}>
            {bank.token.name}
            {formattedBalance && `(${formattedBalance})`}
        </SelectItem>
    );
}
