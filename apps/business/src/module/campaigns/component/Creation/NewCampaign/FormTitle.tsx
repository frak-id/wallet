import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormControl, FormField, FormItem } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { CampaignDraft } from "@/stores/campaignStore";
import { shouldShowError } from "../fieldError";
import { WizardFieldCard } from "../WizardFieldCard";

export function FormTitle() {
    const { t } = useTranslation();
    const { control } = useFormContext<CampaignDraft>();

    return (
        <WizardFieldCard>
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
                                        label={t(
                                            "campaigns.create.basics.title.label"
                                        )}
                                        hint={t(
                                            "campaigns.create.basics.title.hint"
                                        )}
                                        placeholder={t(
                                            "campaigns.create.basics.title.placeholder"
                                        )}
                                        {...field}
                                    />
                                </FormControl>
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
