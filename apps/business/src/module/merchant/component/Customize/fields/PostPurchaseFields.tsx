import { Stack } from "@frak-labs/design-system/components/Stack";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Separator } from "@/module/common/component/Separator";
import type { ComponentSettingsFormValues, WordingLang } from "../types";
import { ComponentCssField, FieldGroup, WordingTextField } from "./shared";

export function PostPurchaseFields({
    form,
    lang,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    lang: WordingLang;
}) {
    const { t } = useTranslation();
    return (
        <Stack space="m">
            <FieldGroup
                title={t("customize.components.postPurchaseGroups.shared")}
            >
                <WordingTextField
                    form={form}
                    name="postPurchase.badgeText"
                    label={t("customize.components.fields.badgeText")}
                    lang={lang}
                />
                <WordingTextField
                    form={form}
                    name="postPurchase.ctaText"
                    label={t("customize.components.fields.ctaText")}
                    lang={lang}
                />
                <WordingTextField
                    form={form}
                    name="postPurchase.ctaNoRewardText"
                    label={t("customize.components.fields.ctaNoRewardText")}
                    lang={lang}
                />
            </FieldGroup>

            <Separator />

            <FieldGroup
                title={t("customize.components.postPurchaseGroups.referee")}
            >
                <WordingTextField
                    form={form}
                    name="postPurchase.refereeText"
                    label={t("customize.components.fields.refereeText")}
                    lang={lang}
                />
                <WordingTextField
                    form={form}
                    name="postPurchase.refereeNoRewardText"
                    label={t("customize.components.fields.refereeNoRewardText")}
                    lang={lang}
                />
            </FieldGroup>

            <Separator />

            <FieldGroup
                title={t("customize.components.postPurchaseGroups.referrer")}
            >
                <WordingTextField
                    form={form}
                    name="postPurchase.referrerText"
                    label={t("customize.components.fields.referrerText")}
                    lang={lang}
                />
                <WordingTextField
                    form={form}
                    name="postPurchase.referrerNoRewardText"
                    label={t(
                        "customize.components.fields.referrerNoRewardText"
                    )}
                    lang={lang}
                />
            </FieldGroup>

            <ComponentCssField
                form={form}
                name="postPurchase.css"
                label={t("customize.components.fields.css")}
                placeholder={".post-purchase { ... }"}
            />
        </Stack>
    );
}
