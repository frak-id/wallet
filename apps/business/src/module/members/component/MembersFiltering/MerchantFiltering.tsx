import { useFormContext } from "react-hook-form";
import type { Hex } from "viem";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyProducts";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { MultiSelect } from "@/module/forms/MultiSelect";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";

export function MerchantFiltering({
    disabled,
    onSubmit,
}: {
    disabled?: boolean;
    onSubmit: (data: FormMembersFiltering) => void;
}) {
    const { isEmpty, merchants } = useMyMerchants();
    const merchantsOptions = [
        ...(merchants?.operator ?? []),
        ...(merchants?.owner ?? []),
    ];
    const { control, handleSubmit } = useFormContext<FormMembersFiltering>();

    if (isEmpty || !merchants) {
        return null;
    }

    return (
        <FormField
            control={control}
            name="merchantIds"
            render={({ field }) => (
                <FormItem>
                    <FormDescription label={"Merchant"} />
                    <FormControl>
                        <MultiSelect
                            disabled={disabled}
                            options={merchantsOptions.map((merchant) => ({
                                name: merchant.name,
                                value: merchant.id,
                            }))}
                            onValueChange={(value) => {
                                const merchantIds = value
                                    .map((v) => v.value as Hex | undefined)
                                    .filter(Boolean);
                                field.onChange(merchantIds);
                                handleSubmit(onSubmit)();
                            }}
                            placeholder="Merchants"
                            {...field}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
