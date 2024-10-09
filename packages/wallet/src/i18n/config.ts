import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./en/default.json";
import fr from "./fr/default.json";

/**
 * The i18n configuration
 *  todo: Maybe a cleaner way possible with a context provider etc?
 *  todo: Typing to fix
 */
export default i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: en,
            },
            fr: {
                translation: fr,
            },
        },
        supportedLngs: ["en", "fr"],
        fallbackLng: "en",
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        debug: true,
    });
