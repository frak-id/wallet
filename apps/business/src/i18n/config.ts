// This is the list of languages the business app supports.
export const supportedLngs = ["en", "fr"] as const;

export type SupportedLang = (typeof supportedLngs)[number];

// French is the bundled (always-available) language. English is lazy-loaded
// in `main.tsx`, so we fall back to French until EN finishes loading.
export const fallbackLng = "fr" satisfies SupportedLang;

// The default namespace for the business app.
export const defaultNS = "translation";

export const interpolation = {
    escapeValue: false, // ensures HTML entities are not escaped
};
