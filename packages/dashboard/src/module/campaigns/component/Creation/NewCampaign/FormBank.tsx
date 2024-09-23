import { Panel } from "@/module/common/component/Panel";
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
import { useGetProductFunding } from "@/module/product/hook/useGetProductFunding";
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";
import { toHex } from "viem";

export function FormBank(form: UseFormReturn<Campaign>) {
    const productId = form.getValues("productId");

    const { data, isLoading } = useGetProductFunding({
        productId: productId !== "" ? toHex(BigInt(productId)) : undefined,
    });
    const isDisabled = isLoading || !data || data.length === 0;

    return (
        <Panel title="Funding bank" aria-disabled={isDisabled}>
            <FormField
                control={form.control}
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
                                        <SelectItem
                                            key={bank.address}
                                            value={bank.address}
                                        >
                                            {bank.token.name} (
                                            {bank.formatted.balance})
                                        </SelectItem>
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
