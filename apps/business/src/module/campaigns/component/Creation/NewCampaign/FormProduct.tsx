import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/ui/component/Select";
import { useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import type { Hex } from "viem";
import { Panel } from "@/module/common/component/Panel";
import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";

export function FormProduct() {
    const { setValue, control } = useFormContext<Campaign>();

    const { isEmpty, products } = useMyProducts();
    const contentList = useMemo(
        () => [...(products?.operator ?? []), ...(products?.owner ?? [])],
        [products]
    );
    const isDisabled = isEmpty || !products || contentList.length === 0;

    // Small hook to auto select a product if there is only one
    useEffect(() => {
        if (contentList.length === 0) return;
        if (contentList.length > 1) return;
        setValue("productId", contentList[0].id);
    }, [contentList, setValue]);

    return (
        <Panel title="Product" aria-disabled={isDisabled}>
            <FormField
                control={control}
                name="productId"
                rules={{ required: "Select a product" }}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Select
                                name={field.name}
                                onValueChange={(value) => {
                                    if (value === "") return;
                                    field.onChange(value as Hex);
                                }}
                                value={field.value}
                                disabled={isDisabled}
                            >
                                <SelectTrigger length={"medium"} {...field}>
                                    <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {contentList.map((content) => (
                                        <SelectItem
                                            key={content.id}
                                            value={content.id}
                                        >
                                            {content.name}
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
