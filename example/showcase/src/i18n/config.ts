import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            fr: { translation: fr },
        },
        fallbackLng: "en",
        supportedLngs: ["en", "fr"],
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ["navigator", "htmlTag"],
            caches: [],
        },
    });

export default i18n;
