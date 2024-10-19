import { isRunningInProd } from "@frak-labs/app-essentials";
import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "./locales/en/translation.json";
import frTranslation from "./locales/fr/translation.json";

/**
 * Define our main i18n instance
 */
export const mainI18nInstance = createInstance({
    supportedLngs: ["en", "fr"],
    fallbackLng: "en",
    resources: {
        en: {
            translation: enTranslation,
        },
        fr: {
            translation: frTranslation,
        },
    },
    interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
    },
    debug: !isRunningInProd,
    defaultNS: "translation",
}).use(LanguageDetector);

/**
 * Function to trigger the i18n instance init
 */
export const initI18nInstance = () => mainI18nInstance.init();
