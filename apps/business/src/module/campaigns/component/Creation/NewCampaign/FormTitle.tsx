import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormControl, FormField, FormItem } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { CampaignDraft } from "@/stores/campaignStore";
import { shouldShowError } from "../fieldError";
import { WizardFieldCard } from "../WizardFieldCard";
import * as styles from "./basics.css";

export function FormTitle() {
    const { t } = useTranslation();
    const { control } = useFormContext<CampaignDraft>();

    return (
        <WizardFieldCard
            insetLabel
            space="xs"
            label={t("campaigns.create.basics.title.label")}
        >
            <FormField
                control={control}
                name="name"
                rules={{
                    required: t("campaigns.create.basics.title.required"),
                }}
                render={({ field, fieldState }) => {
                    const showError = shouldShowError(fieldState);
                    return (
                        <FormItem>
                            <Stack space="xxs">
                                <FormControl>
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        error={showError}
                                        placeholder={t(
                                            "campaigns.create.basics.title.placeholder"
                                        )}
                                        {...field}
                                    />
                                </FormControl>
                                <Text
                                    variant="caption"
                                    color="tertiary"
                                    className={styles.fieldHint}
                                >
                                    {t("campaigns.create.basics.title.hint")}
                                </Text>
                                <FieldError>
                                    {showError
                                        ? fieldState.error?.message
                                        : null}
                                </FieldError>
                            </Stack>
                        </FormItem>
                    );
                }}
            />
        </WizardFieldCard>
    );
}
