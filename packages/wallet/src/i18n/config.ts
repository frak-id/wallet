import { isRunningInProd } from "@frak-labs/app-essentials";
import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

/**
 * The i18n configuration
 *  todo: Maybe a cleaner way possible with a context provider etc?
 *  todo: Typing to fix
 */
export default i18next
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        supportedLngs: ["en", "fr"],
        fallbackLng: "en",
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        debug: !isRunningInProd,
        defaultNS: "translation",
        backend: {
            loadPath: "/locales/{{lng}}/{{ns}}.json",
        },
    });
