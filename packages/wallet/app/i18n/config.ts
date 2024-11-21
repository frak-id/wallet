import enTranslation from "./locales/en/translation.json";
import frTranslation from "./locales/fr/translation.json";

// This is the list of languages your application supports, the last one is your
// fallback language
export const supportedLngs = ["en", "fr"];

// This is the language you want to use in case
// the user language is not in the supportedLngs
export const fallbackLng = "en";

// The default namespace of i18next is "translation", but you can customize it
export const defaultNS = "translation";

export const resources = {
    en: { translation: enTranslation },
    fr: { translation: frTranslation },
};

export const interpolation = {
    escapeValue: false, // this ensures that HTML entities are not escaped
};
