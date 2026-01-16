import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/ui/component/Select";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";

export function FormProduct() {
    const { setValue, control } = useFormContext<Campaign>();

    const { isEmpty, merchants } = useMyMerchants();
    const isDisabled = isEmpty || merchants.length === 0;

    // Auto select merchant if there is only one
    useEffect(() => {
        if (merchants.length !== 1) return;
        setValue("merchantId", merchants[0].id);
    }, [merchants, setValue]);

    return (
        <Panel title="Product" aria-disabled={isDisabled}>
            <FormField
                control={control}
                name="merchantId"
                rules={{ required: "Select a product" }}
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
                                    <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {merchants.map((merchant) => (
                                        <SelectItem
                                            key={merchant.id}
                                            value={merchant.id}
                                        >
                                            {merchant.name}
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
