import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ToggleRow } from "./RevealParts";
import type { RewardFormValues } from "./utils";

export function CampaignTypeField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="referralOnly"
            render={({ field }) => (
                <ToggleRow
                    title={t(
                        "campaigns.create.reward.campaignType.referral.title"
                    )}
                    description={t(
                        "campaigns.create.reward.campaignType.referral.description"
                    )}
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                />
            )}
        />
    );
}
