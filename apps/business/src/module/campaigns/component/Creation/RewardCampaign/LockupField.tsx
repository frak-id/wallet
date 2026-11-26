import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StepperField } from "./StepperField";
import type { RewardFormValues } from "./utils";

export function LockupField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="lockupDays"
            render={({ field }) => (
                <StepperField
                    field={field}
                    unitLabel={t("campaigns.create.reward.lockup.unit")}
                    allowZero
                    placeholder={t(
                        "campaigns.create.reward.lockup.durationPlaceholder"
                    )}
                    label={t("campaigns.create.reward.lockup.durationLabel")}
                    hint={t("campaigns.create.reward.lockup.durationHint")}
                />
            )}
        />
    );
}
