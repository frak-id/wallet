import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    type Control,
    Controller,
    type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/module/common/component/Tooltip";
import { FixedReveal, PercentageReveal } from "./CpaReveal";
import * as styles from "./reward.css";
import { TieredReveal } from "./TieredReveal";
import type { RewardFormValues, RewardModel } from "./utils";

const MODELS = [
    {
        value: "fixed",
        titleKey: "campaigns.create.reward.model.fixed.title",
        descKey: "campaigns.create.reward.model.fixed.description",
    },
    {
        value: "percentage",
        titleKey: "campaigns.create.reward.model.percentage.title",
        descKey: "campaigns.create.reward.model.percentage.description",
    },
    {
        value: "tiered",
        titleKey: "campaigns.create.reward.model.tiered.title",
        descKey: "campaigns.create.reward.model.tiered.description",
    },
] as const satisfies ReadonlyArray<{
    value: RewardModel;
    titleKey: string;
    descKey: string;
}>;

/** The reward-model radio row, followed by the selected model's reveal. */
export function ModelField({
    control,
    setValue,
    model,
    isPurchase,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    model: RewardModel | "";
    isPurchase: boolean;
}) {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            <Controller
                control={control}
                name="model"
                render={({ field }) => (
                    <RadioGroup
                        className={styles.modelRow}
                        value={field.value}
                        onValueChange={field.onChange}
                    >
                        {MODELS.map((m) => {
                            const disabled = !isPurchase && m.value !== "fixed";
                            return (
                                <Tooltip
                                    key={m.value}
                                    hidden={!disabled}
                                    content={t(
                                        "campaigns.create.reward.model.salesOnly"
                                    )}
                                >
                                    <label
                                        htmlFor={`model-${m.value}`}
                                        className={`${styles.modelOption}${disabled ? ` ${styles.modelOptionDisabled}` : ""}`}
                                    >
                                        <RadioGroupItem
                                            id={`model-${m.value}`}
                                            value={m.value}
                                            size="l"
                                            disabled={disabled}
                                        />
                                        <span className={styles.modelMain}>
                                            <Text
                                                variant="body"
                                                weight="medium"
                                            >
                                                {t(m.titleKey)}
                                            </Text>
                                            <Text
                                                variant="bodySmall"
                                                color="secondary"
                                            >
                                                {t(m.descKey)}
                                            </Text>
                                        </span>
                                    </label>
                                </Tooltip>
                            );
                        })}
                    </RadioGroup>
                )}
            />

            {model && <div className={styles.divider} />}
            {model === "fixed" && (
                <FixedReveal control={control} setValue={setValue} />
            )}
            {model === "percentage" && (
                <PercentageReveal control={control} setValue={setValue} />
            )}
            {model === "tiered" && (
                <TieredReveal control={control} setValue={setValue} />
            )}
        </Stack>
    );
}
