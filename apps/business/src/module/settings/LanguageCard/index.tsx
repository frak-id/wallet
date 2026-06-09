import { RadioGroup } from "@frak-labs/design-system/components/RadioGroup";
import { useTranslation } from "react-i18next";
import { type SupportedLang, supportedLngs } from "@/i18n/config";
import { loadEnglishBundle } from "@/i18n/loadBundle";
import { RadioOption } from "../RadioOption";
import * as radio from "../RadioOption/radio-option.css";
import { SettingsCard } from "../SettingsCard";

function resolveLang(language: string | undefined): SupportedLang {
    return language?.startsWith("fr") ? "fr" : "en";
}

export function LanguageCard() {
    const { t, i18n } = useTranslation();
    const current = resolveLang(i18n.language);

    // Static map keeps `t()` keys literal so typed resources can narrow them
    // (and key-extraction tooling can find them).
    const labels: Record<SupportedLang, string> = {
        en: t("settings.language.options.en"),
        fr: t("settings.language.options.fr"),
    };

    async function handleChange(value: string) {
        if (!value) return;
        // Preload the EN bundle BEFORE flipping the language so the UI
        // switches atomically — no FR fallback flash.
        if (value === "en") {
            await loadEnglishBundle();
        }
        await i18n.changeLanguage(value);
    }

    return (
        <SettingsCard
            title={t("settings.language.title")}
            description={t("settings.language.label")}
        >
            <RadioGroup
                className={radio.group}
                value={current}
                onValueChange={(value) => void handleChange(value)}
                aria-label={t("settings.language.title")}
            >
                {supportedLngs.map((lng) => (
                    <RadioOption key={lng} value={lng} label={labels[lng]} />
                ))}
            </RadioGroup>
        </SettingsCard>
    );
}
