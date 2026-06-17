import { Card } from "@frak-labs/design-system/components/Card";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";

/**
 * Campaign name — single inset field (the label aligns with the input text).
 */
export function PushTitlePanel() {
    const { t } = useTranslation();
    const { control } = useFormContext<FormCreatePushNotification>();

    return (
        <Card radius={"m"}>
            <FormField
                control={control}
                name={"pushCampaignTitle"}
                rules={{
                    required: t("push.create.campaign.required"),
                    minLength: {
                        value: 5,
                        message: t("push.create.campaign.minLength"),
                    },
                    maxLength: {
                        value: 100,
                        message: t("push.create.campaign.maxLength"),
                    },
                }}
                render={({ field }) => (
                    <EditField
                        label={t("push.create.campaign.label")}
                        hint={t("push.create.campaign.hint")}
                    >
                        <FormControl>
                            <Input
                                variant={"bare"}
                                tone={"muted"}
                                placeholder={t(
                                    "push.create.campaign.placeholder"
                                )}
                                {...field}
                            />
                        </FormControl>
                    </EditField>
                )}
            />
        </Card>
    );
}
