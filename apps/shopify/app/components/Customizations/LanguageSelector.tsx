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
                    values={[mode]}
                    onChange={(e) =>
                        onModeChange(e.currentTarget.values[0] as LanguageMode)
                    }
                >
                    <s-option value="single">
                        <div>
                            <div>
                                {t("customizations.languageMode.single.label")}
                            </div>
                            <div
                                style={{ fontSize: "0.875rem", color: "#666" }}
                            >
                                {t(
                                    "customizations.languageMode.single.helpText"
                                )}
                            </div>
                        </div>
                    </s-option>
                    <s-option value="multi">
                        <div>
                            <div>
                                {t("customizations.languageMode.multi.label")}
                            </div>
                            <div
                                style={{ fontSize: "0.875rem", color: "#666" }}
                            >
                                {t(
                                    "customizations.languageMode.multi.helpText"
                                )}
                            </div>
                        </div>
                    </s-option>
                </s-choice-list>
            </s-stack>
        </s-section>
    );
}
