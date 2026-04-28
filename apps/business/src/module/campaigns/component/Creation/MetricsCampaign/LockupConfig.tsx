import { REWARD_LOCKUP } from "@frak-labs/app-essentials/constants/rewards";
import { useFormContext } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from "@/module/forms/Form";
import styles from "./index.module.css";
import type { RewardFormState } from "./utils";

/**
 * Reward lockup grace period (in days). During this window, rewards stay
 * `pending` and are not settled on-chain — protecting the campaign budget
 * against refunds and giving identity-merge logic time to detect late
 * self-referrals.
 *
 * `0` disables the lockup so rewards settle on the next cron tick.
 */
export function LockupConfig() {
    const { control } = useFormContext<RewardFormState>();

    return (
        <FormField
            control={control}
            name="lockupDays"
            render={({ field }) => {
                const value = field.value ?? REWARD_LOCKUP.DEFAULT_DAYS;
                return (
                    <FormItem>
                        <FormLabel>Reward lockup (days)</FormLabel>
                        <FormControl>
                            <input
                                type="number"
                                min={REWARD_LOCKUP.MIN_DAYS}
                                max={REWARD_LOCKUP.MAX_DAYS}
                                step={1}
                                className={styles.chaining__input}
                                value={value}
                                onChange={(e) => {
                                    const n = e.target.valueAsNumber;
                                    field.onChange(Number.isFinite(n) ? n : 0);
                                }}
                            />
                        </FormControl>
                        <FormDescription>
                            {value === 0
                                ? "Disabled — rewards settle in a few minutes."
                                : `Rewards stay pending for ${value} day${value === 1 ? "" : "s"} after a purchase, then settle. Refunds during this window cancel the reward and restore the campaign budget.`}
                        </FormDescription>
                    </FormItem>
                );
            }}
        />
    );
}
