import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "./reward.css";
import type { RewardFormValues } from "./utils";

export function CampaignTypeField({
    control,
}: {
    control: Control<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <div className={styles.referralRow}>
            <span className={styles.referralMain}>
                <Text variant="body" weight="medium">
                    {t("campaigns.create.reward.campaignType.referral.title")}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t(
                        "campaigns.create.reward.campaignType.referral.description"
                    )}
                </Text>
            </span>
            <Controller
                control={control}
                name="referralOnly"
                render={({ field }) => (
                    <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                    />
                )}
            />
        </div>
    );
}
