import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { InputAmount } from "@/module/common/component/InputAmount";
import { tokenAddressToCurrency } from "@/module/common/utils/currencyOptions";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import { currencyStore } from "@/stores/currencyStore";
import { calculateDistribution } from "./utils";

export function CacInput() {
    const { control } = useFormContext();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const rewardToken = campaignStore((s) => s.draft.rewardToken);
    const currencyLabel = (
        tokenAddressToCurrency(rewardToken) ?? preferredCurrency
    ).toUpperCase();

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
                        <InputAmount
                            placeholder="100.00"
                            rightSection={currencyLabel}
                            {...field}
                        />
                    </FormControl>
                    {cac > 0 && (
                        <FormDescription>
                            For each conversion, Frak takes{" "}
                            {frakCommission.toFixed(2)} {currencyLabel} (20%
                            commission) and {totalDistributed.toFixed(2)}{" "}
                            {currencyLabel} goes to your users.
                        </FormDescription>
                    )}
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
