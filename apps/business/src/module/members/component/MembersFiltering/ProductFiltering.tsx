import { useFormContext } from "react-hook-form";
import type { Hex } from "viem";
import { useMyProducts } from "@/module/dashboard/hooks/useMyProducts";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { MultiSelect } from "@/module/forms/MultiSelect";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";

export function ProductFiltering({
    disabled,
    onSubmit,
}: {
    disabled?: boolean;
    onSubmit: (data: FormMembersFiltering) => void;
}) {
    const { isEmpty, products } = useMyProducts();
    const productsOptions = [
        ...(products?.operator ?? []),
        ...(products?.owner ?? []),
    ];
    const { control, handleSubmit } = useFormContext<FormMembersFiltering>();

    if (isEmpty || !products) {
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
                            disabled={disabled}
                            options={productsOptions.map((product) => ({
                                name: product.name,
                                value: product.id,
                            }))}
                            onValueChange={(value) => {
                                const productIds = value
                                    .map((v) => v.value as Hex | undefined)
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
