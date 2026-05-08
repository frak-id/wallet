// This is the list of languages your application supports, the last one is your
// fallback language
export const supportedLngs = ["en", "fr"];

// French is the bundled (always-available) language. English is lazy-loaded
// in app entry points, so we fall back to French until EN finishes loading.
export const fallbackLng = "fr";

// The default namespace of i18next is "translation", but you can customize it
export const defaultNS = "translation";

export const interpolation = {
    escapeValue: false, // this ensures that HTML entities are not escaped
};
