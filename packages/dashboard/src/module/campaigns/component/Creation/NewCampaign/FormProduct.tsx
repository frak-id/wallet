import { Panel } from "@/module/common/component/Panel";
import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
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
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormProduct(form: UseFormReturn<Campaign>) {
    const { isEmpty, products } = useMyProducts();
    const contentList = [
        ...(products?.operator ?? []),
        ...(products?.owner ?? []),
    ];

    if (isEmpty) return null;

    return (
        <Panel title="Product">
            <FormField
                control={form.control}
                name="productId"
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
                            >
                                <SelectTrigger length={"medium"} {...field}>
                                    <SelectValue placeholder="Select a product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {contentList.map((content) => (
                                        <SelectItem
                                            key={content.id}
                                            value={content.id.toString()}
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
