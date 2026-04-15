import { Switch } from "@frak-labs/ui/component/Switch";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Row } from "@/module/common/component/Row";
import { tokenAddressToCurrency } from "@/module/common/utils/currencyOptions";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import { currencyStore } from "@/stores/currencyStore";
import styles from "./index.module.css";
import { calculateChainDistribution, calculateDistribution } from "./utils";

export function ChainingConfig() {
    const { control, setValue } = useFormContext();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const rewardToken = campaignStore((s) => s.draft.rewardToken);
    const currencyLabel = (
        tokenAddressToCurrency(rewardToken) ?? preferredCurrency
    ).toUpperCase();

    const cac = useWatch({ control, name: "cac" }) ?? 0;
    const ratio = useWatch({ control, name: "ratio" }) ?? 90;
    const chainingEnabled =
        useWatch({ control, name: "chainingEnabled" }) ?? true;
    const deperditionPerLevel =
        useWatch({ control, name: "deperditionPerLevel" }) ?? 80;
    const maxDepth = useWatch({ control, name: "maxDepth" }) ?? 5;

    const { referrerAmount } = useMemo(
        () => calculateDistribution(cac, ratio),
        [cac, ratio]
    );

    const chainDistribution = useMemo(
        () =>
            chainingEnabled
                ? calculateChainDistribution(
                      referrerAmount,
                      deperditionPerLevel,
                      maxDepth
                  )
                : [],
        [chainingEnabled, referrerAmount, deperditionPerLevel, maxDepth]
    );

    return (
        <div className={styles.chaining}>
            <div className={styles.chaining__header}>
                <div className={styles.chaining__headerText}>
                    <span className={styles.chaining__title}>
                        Enable Chain Rewards
                    </span>
                    <span className={styles.chaining__description}>
                        Distribute referrer rewards through the referral chain
                    </span>
                </div>
                <FormField
                    control={control}
                    name="chainingEnabled"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Switch
                                    checked={field.value ?? true}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            {chainingEnabled && (
                <>
                    <Row>
                        <FormField
                            control={control}
                            name="deperditionPerLevel"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Decay per level (%)</FormLabel>
                                    <FormControl>
                                        <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            className={styles.chaining__input}
                                            value={field.value ?? 80}
                                            onChange={(e) =>
                                                setValue(
                                                    "deperditionPerLevel",
                                                    Math.min(
                                                        100,
                                                        Math.max(
                                                            1,
                                                            parseInt(
                                                                e.target.value,
                                                                10
                                                            ) || 80
                                                        )
                                                    ),
                                                    { shouldDirty: true }
                                                )
                                            }
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="maxDepth"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Max chain depth</FormLabel>
                                    <FormControl>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            className={styles.chaining__input}
                                            value={field.value ?? 5}
                                            onChange={(e) =>
                                                setValue(
                                                    "maxDepth",
                                                    Math.min(
                                                        10,
                                                        Math.max(
                                                            1,
                                                            parseInt(
                                                                e.target.value,
                                                                10
                                                            ) || 5
                                                        )
                                                    ),
                                                    { shouldDirty: true }
                                                )
                                            }
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </Row>

                    {chainDistribution.length > 0 && referrerAmount > 0 && (
                        <FormItem>
                            <FormDescription
                                label={`Chain Distribution Preview (${referrerAmount.toFixed(2)} ${currencyLabel} referrer pool)`}
                            />
                            <div className={styles.chaining__bars}>
                                {chainDistribution.map((item) => (
                                    <div
                                        key={item.level}
                                        className={styles.chaining__bar}
                                    >
                                        <div
                                            className={styles.chaining__barInfo}
                                        >
                                            <span>Level {item.level}</span>
                                            <span>
                                                {item.amount.toFixed(2)}{" "}
                                                {currencyLabel} (
                                                {item.percentage}%)
                                            </span>
                                        </div>
                                        <div
                                            className={
                                                styles.chaining__barTrack
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.chaining__barFill
                                                }
                                                style={{
                                                    width: `${item.percentage}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </FormItem>
                    )}
                </>
            )}
        </div>
    );
}
