import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { MultiSelect } from "@/module/forms/MultiSelect";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { useFormContext } from "react-hook-form";

export function ProductFiltering() {
    const { isEmpty, products, isPending } = useMyProducts();
    const productsOptions = [
        ...(products?.operator ?? []),
        ...(products?.owner ?? []),
    ];
    const { control } = useFormContext<FormMembersFiltering>();

    if (isEmpty || !products || isPending) {
        return null;
    }

    return (
        <FormField
            control={control}
            name="productIds"
            render={({ field }) => (
                <FormItem>
                    <FormLabel variant={"dark"} weight={"medium"}>
                        Filter by products
                    </FormLabel>
                    <FormControl>
                        <MultiSelect
                            options={productsOptions.map((product) => ({
                                name: product.name,
                                value: product.id.toString(),
                            }))}
                            onValueChange={(value) => {
                                const productIds = value
                                    .map((v) => v.value)
                                    .filter(Boolean);
                                field.onChange(productIds);
                            }}
                            placeholder="Products"
                            {...field}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
