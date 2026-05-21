import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { useTranslation } from "react-i18next";
import { type SupportedLang, supportedLngs } from "@/i18n/config";
import { loadEnglishBundle } from "@/i18n/loadBundle";
import { settingsField, settingsFieldLabel } from "../settings-field.css";

function resolveLang(language: string | undefined): SupportedLang {
    return language?.startsWith("fr") ? "fr" : "en";
}

export function LanguageSelector() {
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
        <div className={settingsField}>
            <label htmlFor="language-select" className={settingsFieldLabel}>
                {t("settings.language.label")}
            </label>
            <Select
                name="language-select"
                onValueChange={(value) => void handleChange(value)}
                value={current}
            >
                <SelectTrigger id="language-select" length={"medium"}>
                    <SelectValue
                        placeholder={t("settings.language.placeholder")}
                    />
                </SelectTrigger>
                <SelectContent>
                    {supportedLngs.map((lng) => (
                        <SelectItem key={lng} value={lng}>
                            {labels[lng]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
