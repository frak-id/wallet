import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StepperField } from "./StepperField";
import type { RewardFormValues } from "./utils";

export function EligibilityField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="minPurchaseAmount"
            render={({ field }) => (
                <StepperField
                    field={field}
                    unit="amount"
                    allowZero
                    placeholder={t(
                        "campaigns.create.reward.eligibility.minPurchasePlaceholder"
                    )}
                    label={t(
                        "campaigns.create.reward.eligibility.minPurchaseLabel"
                    )}
                    hint={t(
                        "campaigns.create.reward.eligibility.minPurchaseHint"
                    )}
                />
            )}
        />
    );
}
