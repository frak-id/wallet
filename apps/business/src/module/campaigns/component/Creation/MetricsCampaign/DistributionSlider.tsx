import { Inline } from "@frak-labs/design-system/components/Inline";
import { Slider } from "@frak-labs/design-system/components/Slider";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { tokenAddressToCurrency } from "@/module/common/utils/currencyOptions";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/module/forms/Form";
import { campaignStore } from "@/stores/campaignStore";
import { currencyStore } from "@/stores/currencyStore";
import * as styles from "./metrics-campaign.css";
import { calculateDistribution } from "./utils";

export function DistributionSlider() {
    const { control, setValue } = useFormContext();
    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const rewardToken = campaignStore((s) => s.draft.rewardToken);
    const currencyLabel = (
        tokenAddressToCurrency(rewardToken) ?? preferredCurrency
    ).toUpperCase();

    const cac = useWatch({ control, name: "cac" }) ?? 0;
    const ratio = useWatch({ control, name: "ratio" }) ?? 90;

    const { refereeAmount, referrerAmount } = useMemo(
        () => calculateDistribution(cac, ratio),
        [cac, ratio]
    );

    const refereePercent = 100 - ratio;

    return (
        <Stack space="m">
            <FormField
                control={control}
                name="ratio"
                render={({ field }) => (
                    <FormItem>
                        <Inline space="xs" alignY="center">
                            <FormLabel>Repartition</FormLabel>
                            <span className={styles.distributionPercentage}>
                                {refereePercent}%
                            </span>
                        </Inline>
                        <FormControl>
                            <div className={styles.distributionSlider}>
                                <span className={styles.distributionLabel}>
                                    Referee
                                </span>
                                <Slider
                                    label="Distribution ratio"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={[100 - (field.value ?? 90)]}
                                    onValueChange={(values) => {
                                        setValue("ratio", 100 - values[0], {
                                            shouldDirty: true,
                                        });
                                    }}
                                />
                                <span className={styles.distributionLabel}>
                                    Referrer
                                </span>
                            </div>
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className={styles.distributionPreview}>
                <div className={styles.distributionCard}>
                    <span className={styles.distributionCardLabel}>
                        Referee Earnings
                    </span>
                    <span className={styles.distributionCardAmount}>
                        {refereeAmount.toFixed(2)} {currencyLabel}
                    </span>
                </div>
                <div className={styles.distributionCard}>
                    <span className={styles.distributionCardLabel}>
                        Referrer Earnings
                    </span>
                    <span className={styles.distributionCardAmount}>
                        {referrerAmount.toFixed(2)} {currencyLabel}
                    </span>
                </div>
            </div>
        </Stack>
    );
}
