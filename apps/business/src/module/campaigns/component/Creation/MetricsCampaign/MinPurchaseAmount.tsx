import { useFormContext } from "react-hook-form";
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
import type { RewardFormState } from "./utils";

/**
 * Minimum purchase amount required to trigger the reward.
 * Stored as a `purchase.amount >= value` rule condition at API submission time.
 * `0` disables the threshold so any purchase qualifies.
 */
export function MinPurchaseAmount() {
    const { control } = useFormContext<RewardFormState>();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const rewardToken = campaignStore((s) => s.draft.rewardToken);
    const currencyLabel = (
        tokenAddressToCurrency(rewardToken) ?? preferredCurrency
    ).toUpperCase();

    return (
        <FormField
            control={control}
            name="minPurchaseAmount"
            rules={{
                min: {
                    value: 0,
                    message: "Minimum purchase amount cannot be negative",
                },
            }}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Minimum purchase amount</FormLabel>
                    <FormControl>
                        <InputAmount
                            placeholder="0.00"
                            rightSection={currencyLabel}
                            {...field}
                        />
                    </FormControl>
                    <FormDescription>
                        Purchases below this amount won't trigger a reward. Set
                        to 0 to allow any purchase amount.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
