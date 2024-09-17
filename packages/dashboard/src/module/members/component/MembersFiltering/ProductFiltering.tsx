import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { MultiSelect } from "@/module/forms/MultiSelect";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { useFormContext } from "react-hook-form";

export function ProductFiltering({
    onSubmit,
}: { onSubmit: (data: FormMembersFiltering) => void }) {
    const { isEmpty, products, isPending } = useMyProducts();
    const productsOptions = [
        ...(products?.operator ?? []),
        ...(products?.owner ?? []),
    ];
    const { control, handleSubmit } = useFormContext<FormMembersFiltering>();

    if (isEmpty || !products || isPending) {
        return null;
    }

    return (
        <FormField
            control={control}
            name="productIds"
            render={({ field }) => (
                <FormItem>
                    <FormDescription label={"Product"} />
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
                                handleSubmit(onSubmit)();
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
