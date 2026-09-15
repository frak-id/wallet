import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "../customize.css";
import type {
    ComponentSettingsFormValues,
    StyleTier,
    WordingLang,
} from "../types";
import { ButtonShareStyleFields } from "./ButtonShareStyleFields";
import { ComponentCssField, WordingTextField } from "./shared";

export function ButtonShareFields({
    form,
    lang,
    tier,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    lang: WordingLang;
    tier: StyleTier;
}) {
    const { t } = useTranslation();
    return (
        <>
            <div className={styles.settingsGrid}>
                <WordingTextField
                    form={form}
                    name="buttonShare.text"
                    label={t("customize.components.fields.text")}
                    lang={lang}
                />
                <WordingTextField
                    form={form}
                    name="buttonShare.noRewardText"
                    label={t("customize.components.fields.noRewardText")}
                    lang={lang}
                />
                <ComponentCssField
                    form={form}
                    name="buttonShare.foreignCss"
                    label={t("customize.components.fields.css")}
                    placeholder={".frak-button-share { ... }"}
                />
            </div>
            <ButtonShareStyleFields form={form} tier={tier} />
        </>
    );
}
