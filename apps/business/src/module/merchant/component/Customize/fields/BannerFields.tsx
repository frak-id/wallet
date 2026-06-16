import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "../customize.css";
import type { ComponentSettingsFormValues, WordingLang } from "../types";
import { ComponentCssField, WordingTextField } from "./shared";

export function BannerFields({
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
                name="banner.referralTitle"
                label={t("customize.components.fields.referralTitle")}
                lang={lang}
            />
            <WordingTextField
                form={form}
                name="banner.referralDescription"
                label={t("customize.components.fields.referralDescription")}
                lang={lang}
            />
            <WordingTextField
                form={form}
                name="banner.referralCta"
                label={t("customize.components.fields.referralCta")}
                lang={lang}
            />
            <WordingTextField
                form={form}
                name="banner.inappTitle"
                label={t("customize.components.fields.inappTitle")}
                lang={lang}
            />
            <WordingTextField
                form={form}
                name="banner.inappDescription"
                label={t("customize.components.fields.inappDescription")}
                lang={lang}
            />
            <WordingTextField
                form={form}
                name="banner.inappCta"
                label={t("customize.components.fields.inappCta")}
                lang={lang}
            />
            <ComponentCssField
                form={form}
                name="banner.css"
                label={t("customize.components.fields.css")}
                placeholder={".frak-banner { ... }"}
            />
        </div>
    );
}
