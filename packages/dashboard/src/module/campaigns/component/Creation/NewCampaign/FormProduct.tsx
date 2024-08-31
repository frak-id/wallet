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
import { usePrevious } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

export function FormProduct(form: UseFormReturn<Campaign>) {
    const { isEmpty, products } = useMyProducts();
    const contentList = [
        ...(products?.operator ?? []),
        ...(products?.owner ?? []),
    ];

    // Force refresh the form when reset the contentId
    const [forceRefresh, setForceRefresh] = useState(new Date().getTime());
    const watchProductId = form.watch("productId");
    const previousContentId = usePrevious(watchProductId);

    /**
     * Reset contentId
     */
    useEffect(() => {
        if (watchProductId === "" && !previousContentId) return;
        setForceRefresh(new Date().getTime());
    }, [watchProductId, previousContentId]);

    if (isEmpty) return null;

    return (
        <Panel title="Product">
            <FormField
                key={forceRefresh}
                control={form.control}
                name="productId"
                rules={{ required: "Select a product" }}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Select
                                name={field.name}
                                onValueChange={field.onChange}
                                defaultValue={field.value}
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
