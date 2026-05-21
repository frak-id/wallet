import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
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
import * as styles from "./metrics-campaign.css";
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
        useWatch({ control, name: "chainingEnabled" }) ?? false;
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
        <Stack space="m">
            <Inline space="m" align="space-between" alignY="center">
                <Stack space="xxs">
                    <span className={styles.chainingTitle}>
                        Enable Chain Rewards
                    </span>
                    <Text as="span" variant="bodySmall" color="secondary">
                        Distribute referrer rewards through the referral chain
                    </Text>
                </Stack>
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
            </Inline>

            {chainingEnabled && (
                <>
                    <Inline space="m" alignY="bottom">
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
                                            className={styles.chainingInput}
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
                                            className={styles.chainingInput}
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
                    </Inline>

                    {chainDistribution.length > 0 && referrerAmount > 0 && (
                        <FormItem>
                            <FormDescription
                                label={`Chain Distribution Preview (${referrerAmount.toFixed(2)} ${currencyLabel} referrer pool)`}
                            />
                            <Stack space="xs">
                                {chainDistribution.map((item) => (
                                    <Stack key={item.level} space="xxs">
                                        <div className={styles.chainingBarInfo}>
                                            <span>Level {item.level}</span>
                                            <span>
                                                {item.amount.toFixed(2)}{" "}
                                                {currencyLabel} (
                                                {item.percentage}%)
                                            </span>
                                        </div>
                                        <div
                                            className={styles.chainingBarTrack}
                                        >
                                            <div
                                                className={
                                                    styles.chainingBarFill
                                                }
                                                style={{
                                                    width: `${item.percentage}%`,
                                                }}
                                            />
                                        </div>
                                    </Stack>
                                ))}
                            </Stack>
                        </FormItem>
                    )}
                </>
            )}
        </Stack>
    );
}
