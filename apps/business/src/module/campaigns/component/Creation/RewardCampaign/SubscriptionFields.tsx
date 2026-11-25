import { Inline } from "@frak-labs/design-system/components/Inline";
import { RadioGroup } from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import {
    type Control,
    Controller,
    type UseFormGetValues,
    type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RadioOptionCard, ToggleRow } from "./RevealParts";
import * as styles from "./reward.css";
import { StepperField } from "./StepperField";
import {
    allowedModels,
    type PlanTotalLabels,
    STEP_BY,
    type StepBy,
} from "./subscription";
import type { RewardFormValues } from "./utils";

/** Regular sales campaigns: keep subscription orders out of the reward. */
export function ExcludeSubscriptionsField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="excludeSubscriptions"
            render={({ field }) => (
                <ToggleRow
                    title={t(
                        "campaigns.create.reward.subscription.exclude.title"
                    )}
                    description={t(
                        "campaigns.create.reward.subscription.exclude.description"
                    )}
                    checked={field.value ?? false}
                    onCheckedChange={field.onChange}
                />
            )}
        />
    );
}

/** How rewards after the first payment unlock; a model the progression cannot pay falls back to fixed. */
export function StepByField({
    control,
    setValue,
    getValues,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    getValues: UseFormGetValues<RewardFormValues>;
}) {
    const { t } = useTranslation();
    const [fellBack, setFellBack] = useState(false);
    return (
        <Stack space="xs">
            <Controller
                control={control}
                name="stepBy"
                render={({ field }) => (
                    <RadioGroup
                        className={styles.modelRow}
                        aria-label={t(
                            "campaigns.create.reward.subscription.stepBy.title"
                        )}
                        value={field.value}
                        onValueChange={(value) => {
                            const stepBy = STEP_BY.find(
                                (option) => option === value
                            );
                            if (!stepBy) return;
                            field.onChange(stepBy);
                            const model = getValues("model");
                            const falls =
                                model !== "" &&
                                !allowedModels(stepBy).includes(model);
                            if (falls) {
                                setValue("model", "fixed", {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                });
                            }
                            setFellBack(falls);
                        }}
                    >
                        {STEP_BY.map((stepBy) => (
                            <RadioOptionCard
                                key={stepBy}
                                id={`step-by-${stepBy}`}
                                value={stepBy}
                                title={t(
                                    `campaigns.create.reward.subscription.stepBy.${stepBy}.title`
                                )}
                                description={t(
                                    `campaigns.create.reward.subscription.stepBy.${stepBy}.description`
                                )}
                            />
                        ))}
                    </RadioGroup>
                )}
            />
            {fellBack && (
                <Text variant="caption" color="tertiary">
                    {t(
                        "campaigns.create.reward.subscription.stepBy.modelFallback"
                    )}
                </Text>
            )}
        </Stack>
    );
}

const STEP_SIZE = {
    amount: { name: "stepAmount", unit: "amount", step: 0.01 },
    duration: { name: "stepDays", unit: undefined, step: undefined },
} as const;

/** The amount paid, or the days subscribed, that unlock each reward after the first payment. */
export function StepSizeField({
    control,
    stepBy,
}: {
    control: Control<RewardFormValues>;
    stepBy: StepBy;
}) {
    const { t } = useTranslation();
    if (stepBy === "cycle") return null;
    const { name, unit, step } = STEP_SIZE[stepBy];
    const key = `campaigns.create.reward.subscription.${name}` as const;
    return (
        <Controller
            control={control}
            name={name}
            render={({ field }) => (
                <StepperField
                    field={field}
                    tone="elevated"
                    unit={unit}
                    step={step}
                    unitLabel={
                        stepBy === "duration"
                            ? t(
                                  "campaigns.create.reward.subscription.stepDays.unit"
                              )
                            : undefined
                    }
                    placeholder={t(`${key}.placeholder`)}
                    label={t(`${key}.label`)}
                    hint={t(`${key}.hint`)}
                />
            )}
        />
    );
}

export function InactivityField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="inactivityDays"
            render={({ field }) => (
                <StepperField
                    field={field}
                    unitLabel={t(
                        "campaigns.create.reward.subscription.inactivity.unit"
                    )}
                    placeholder={t(
                        "campaigns.create.reward.subscription.inactivity.placeholder"
                    )}
                    label={t(
                        "campaigns.create.reward.subscription.inactivity.label"
                    )}
                    hint={t(
                        "campaigns.create.reward.subscription.inactivity.hint"
                    )}
                />
            )}
        />
    );
}

/** Plan total per side, Frak's commission and the CPA, already formatted ("≈" when estimated). */
export function PlanTotalsSummary({ labels }: { labels: PlanTotalLabels }) {
    const { t } = useTranslation();
    const rows = [
        {
            key: "ambassador",
            label: t("campaigns.create.reward.subscription.totals.ambassador"),
            value: labels.referrer,
        },
        {
            key: "referee",
            label: t("campaigns.create.reward.subscription.totals.referee"),
            value: labels.referee,
        },
        {
            key: "commission",
            label: t("campaigns.create.reward.cpa.frakCommission"),
            value: labels.commission,
        },
        {
            key: "cpa",
            label: t("campaigns.create.reward.subscription.totals.cpa"),
            value: labels.cpa,
        },
    ];
    return (
        <Stack
            space="xs"
            paddingX="m"
            paddingY="s"
            className={styles.planTotals}
        >
            <Text variant="caption" color="tertiary">
                {t("campaigns.create.reward.subscription.totals.title")}
            </Text>
            {rows.map((row) => (
                <Inline
                    key={row.key}
                    space="m"
                    align="space-between"
                    className={styles.planTotalRow}
                >
                    <Text as="span" variant="bodySmall" color="secondary">
                        {row.label}
                    </Text>
                    <Text as="span" variant="bodySmall" weight="medium">
                        {row.value}
                    </Text>
                </Inline>
            ))}
        </Stack>
    );
}
