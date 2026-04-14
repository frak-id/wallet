import { useTranslation } from "react-i18next";

type LanguageMode = "single" | "multi";

interface LanguageModeSelectorProps {
    mode: LanguageMode;
    onModeChange: (mode: LanguageMode) => void;
}

export function LanguageModeSelector({
    mode,
    onModeChange,
}: LanguageModeSelectorProps) {
    const { t } = useTranslation();

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("customizations.languageMode.title")}</s-heading>
                <s-choice-list
                    name="languageMode"
                    label={t("customizations.languageMode.title")}
                    values={[mode]}
                    onChange={(e) => {
                        const values = e.currentTarget.values;
                        if (values) onModeChange(values[0] as LanguageMode);
                    }}
                >
                    <s-choice value="single">
                        {t("customizations.languageMode.single.label")}
                    </s-choice>
                    <s-choice value="multi">
                        {t("customizations.languageMode.multi.label")}
                    </s-choice>
                </s-choice-list>
            </s-stack>
        </s-section>
    );
}
