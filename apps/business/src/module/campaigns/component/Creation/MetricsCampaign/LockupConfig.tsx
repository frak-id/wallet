import { useFormContext } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from "@/module/forms/Form";
import styles from "./index.module.css";
import { DEFAULT_LOCKUP_DAYS, MAX_LOCKUP_DAYS, MIN_LOCKUP_DAYS } from "./utils";

/**
 * Reward lockup grace period (in days). During this window, rewards stay
 * `pending` and are not settled on-chain — protecting the campaign budget
 * against refunds and giving identity-merge logic time to detect late
 * self-referrals.
 *
 * `0` disables the lockup so rewards settle on the next cron tick.
 */
export function LockupConfig() {
    const { control, setValue } = useFormContext();

    return (
        <FormField
            control={control}
            name="lockupDays"
            render={({ field }) => {
                const value = field.value ?? DEFAULT_LOCKUP_DAYS;
                const isDisabled = value === 0;
                return (
                    <FormItem>
                        <FormLabel>Reward lockup (days)</FormLabel>
                        <FormControl>
                            <input
                                type="number"
                                min={MIN_LOCKUP_DAYS}
                                max={MAX_LOCKUP_DAYS}
                                step={1}
                                className={styles.chaining__input}
                                value={value}
                                onChange={(e) =>
                                    setValue(
                                        "lockupDays",
                                        Math.min(
                                            MAX_LOCKUP_DAYS,
                                            Math.max(
                                                MIN_LOCKUP_DAYS,
                                                parseInt(e.target.value, 10) ||
                                                    0
                                            )
                                        ),
                                        { shouldDirty: true }
                                    )
                                }
                            />
                        </FormControl>
                        <FormDescription>
                            {isDisabled
                                ? "Disabled — rewards settle on the next cron tick."
                                : `Rewards stay pending for ${value} day${value === 1 ? "" : "s"} after a purchase, then settle on-chain. Refunds during this window cancel the reward and restore the campaign budget.`}
                        </FormDescription>
                    </FormItem>
                );
            }}
        />
    );
}
