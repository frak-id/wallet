import { Stack } from "@frak-labs/design-system/components/Stack";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InfoBanner } from "../InfoBanner";
import { StepperField } from "./StepperField";
import type { RewardFormValues } from "./utils";

export function LockupField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            <InfoBanner>{t("campaigns.create.reward.lockup.info")}</InfoBanner>
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
                        label={t(
                            "campaigns.create.reward.lockup.durationLabel"
                        )}
                        hint={t("campaigns.create.reward.lockup.durationHint")}
                    />
                )}
            />
        </Stack>
    );
}
