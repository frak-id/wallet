import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { CampaignDraft } from "@/stores/campaignStore";
import { WizardFieldCard } from "../WizardFieldCard";
import * as styles from "./basics.css";

export function FormTitle() {
    const { t } = useTranslation();
    const { control } = useFormContext<CampaignDraft>();

    return (
        <WizardFieldCard
            insetLabel
            label={t("campaigns.create.basics.title.label")}
        >
            <FormField
                control={control}
                name="name"
                rules={{
                    required: t("campaigns.create.basics.title.label"),
                }}
                render={({ field }) => (
                    <FormItem>
                        <Stack space="xxs">
                            <FormControl>
                                <Input
                                    variant="bare"
                                    tone="muted"
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
                            <FormMessage />
                        </Stack>
                    </FormItem>
                )}
            />
        </WizardFieldCard>
    );
}
