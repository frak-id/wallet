import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { InputAmountCampaign } from "@/module/common/component/InputAmount";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { currencyStore } from "@/stores/currencyStore";
import { calculateDistribution } from "./utils";

export function CacInput() {
    const { control } = useFormContext();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);

    const cac = useWatch({ control, name: "cac" }) ?? 0;
    const ratio = useWatch({ control, name: "ratio" }) ?? 90;

    const { frakCommission, refereeAmount, referrerAmount } = useMemo(
        () => calculateDistribution(cac, ratio),
        [cac, ratio]
    );

    const totalDistributed = refereeAmount + referrerAmount;

    return (
        <FormField
            control={control}
            name="cac"
            rules={{
                required: "Target CPA is required",
                min: { value: 0.01, message: "CPA must be greater than 0" },
            }}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>CPA</FormLabel>
                    <FormControl>
                        <InputAmountCampaign placeholder="100.00" {...field} />
                    </FormControl>
                    {cac > 0 && (
                        <FormDescription>
                            For each conversion, Frak takes{" "}
                            {frakCommission.toFixed(2)}{" "}
                            {preferredCurrency.toUpperCase()} (20% commission)
                            and {totalDistributed.toFixed(2)}{" "}
                            {preferredCurrency.toUpperCase()} goes to your
                            users.
                        </FormDescription>
                    )}
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
