import { RadioGroup } from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    type Control,
    Controller,
    type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/module/common/component/Tooltip";
import { FixedReveal, PercentageReveal } from "./CpaReveal";
import { RadioOptionCard } from "./RevealParts";
import * as styles from "./reward.css";
import { SubscriptionPeriodsReveal } from "./SubscriptionReveal";
import { allowedModels, type StepBy } from "./subscription";
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
    isSubscription,
    stepBy,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    model: RewardModel | "";
    isPurchase: boolean;
    isSubscription: boolean;
    stepBy: StepBy;
}) {
    const { t } = useTranslation();
    const disabledReason = (value: RewardModel): string | undefined => {
        if (!isPurchase && value !== "fixed") {
            return t("campaigns.create.reward.model.salesOnly");
        }
        if (isSubscription && value === "tiered") {
            return t("campaigns.create.reward.subscription.tieredUnavailable");
        }
        if (isSubscription && !allowedModels(stepBy).includes(value)) {
            return t(
                "campaigns.create.reward.subscription.stepBy.modelNotAllowed"
            );
        }
        return undefined;
    };
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
                            const reason = disabledReason(m.value);
                            const disabled = reason !== undefined;
                            return (
                                <Tooltip
                                    key={m.value}
                                    hidden={!disabled}
                                    content={reason ?? ""}
                                >
                                    <RadioOptionCard
                                        id={`model-${m.value}`}
                                        value={m.value}
                                        title={t(m.titleKey)}
                                        description={t(m.descKey)}
                                        disabled={disabled}
                                    />
                                </Tooltip>
                            );
                        })}
                    </RadioGroup>
                )}
            />

            {model && <div className={styles.divider} />}
            {isSubscription ? (
                (model === "fixed" || model === "percentage") && (
                    <SubscriptionPeriodsReveal
                        control={control}
                        setValue={setValue}
                        model={model}
                    />
                )
            ) : (
                <>
                    {model === "fixed" && (
                        <FixedReveal control={control} setValue={setValue} />
                    )}
                    {model === "percentage" && (
                        <PercentageReveal
                            control={control}
                            setValue={setValue}
                        />
                    )}
                    {model === "tiered" && (
                        <TieredReveal control={control} setValue={setValue} />
                    )}
                </>
            )}
        </Stack>
    );
}
