import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/ui/component/Select";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { keccak256, toHex } from "viem";
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

    useEffect(() => {
        if (merchants.length !== 1) return;
        const merchant = merchants[0];

        setValue("merchantId", merchant.id);

        const productId = keccak256(toHex(merchant.domain.replace("www.", "")));
        setValue("productId", productId);
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
                                onValueChange={(merchantId) => {
                                    if (merchantId === "") return;
                                    field.onChange(merchantId);

                                    const merchant = merchants.find(
                                        (m) => m.id === merchantId
                                    );
                                    if (!merchant) return;

                                    const productId = keccak256(
                                        toHex(
                                            merchant.domain.replace("www.", "")
                                        )
                                    );
                                    setValue("productId", productId);
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
