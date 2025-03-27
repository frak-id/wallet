import type { Language } from "@frak-labs/core-sdk";

/**
 * The languages available for the configuration
 */
export const languages = [
    { value: "auto", label: "🌐 Automatic" },
    { value: "en", label: "🇬🇧 English" },
    { value: "fr", label: "🇫🇷 French" },
];

/**
 * Get the label of a language
 * @param language - The language to get the label of
 * @returns The label of the language
 */
export const getLanguageLabel = (language: Language) => {
    return languages.find((lang) => lang.value === language)?.label;
};
