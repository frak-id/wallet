import { Slider } from "@frak-labs/ui/component/Slider";
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
import styles from "./index.module.css";
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
        <div className={styles.distribution}>
            <FormField
                control={control}
                name="ratio"
                render={({ field }) => (
                    <FormItem>
                        <div className={styles.distribution__labelRow}>
                            <FormLabel>Repartition</FormLabel>
                            <span className={styles.distribution__percentage}>
                                {refereePercent}%
                            </span>
                        </div>
                        <FormControl>
                            <div className={styles.distribution__slider}>
                                <span className={styles.distribution__label}>
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
                                <span className={styles.distribution__label}>
                                    Referrer
                                </span>
                            </div>
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className={styles.distribution__preview}>
                <div className={styles.distribution__card}>
                    <span className={styles.distribution__cardLabel}>
                        Referee Earnings
                    </span>
                    <span className={styles.distribution__cardAmount}>
                        {refereeAmount.toFixed(2)} {currencyLabel}
                    </span>
                </div>
                <div className={styles.distribution__card}>
                    <span className={styles.distribution__cardLabel}>
                        Referrer Earnings
                    </span>
                    <span className={styles.distribution__cardAmount}>
                        {referrerAmount.toFixed(2)} {currencyLabel}
                    </span>
                </div>
            </div>
        </div>
    );
}
