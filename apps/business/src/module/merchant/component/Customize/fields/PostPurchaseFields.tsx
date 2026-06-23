import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "../customize.css";
import type { ComponentSettingsFormValues, WordingLang } from "../types";
import { ComponentCssField, WordingTextField } from "./shared";

export function PostPurchaseFields({
    form,
    lang,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    lang: WordingLang;
}) {
    const { t } = useTranslation();
    return (
        <div className={styles.settingsGrid}>
            <WordingTextField
                form={form}
                name="postPurchase.badgeText"
                label={t("customize.components.fields.badgeText")}
                lang={lang}
            />
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
            <WordingTextField
                form={form}
                name="postPurchase.referrerText"
                label={t("customize.components.fields.referrerText")}
                lang={lang}
            />
            <WordingTextField
                form={form}
                name="postPurchase.referrerNoRewardText"
                label={t("customize.components.fields.referrerNoRewardText")}
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
            <ComponentCssField
                form={form}
                name="postPurchase.css"
                label={t("customize.components.fields.css")}
                placeholder={".post-purchase { ... }"}
            />
        </div>
    );
}
