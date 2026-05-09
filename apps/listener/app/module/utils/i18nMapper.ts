import type { I18nConfig, LocalizedI18nConfig } from "@frak-labs/core-sdk";
import type { i18n as I18nType } from "i18next";

/**
 * Map an i18n config to a localized i18n config
 * @param value
 * @param i18n
 * @returns
 */
export async function mapI18nConfig(value: I18nConfig, i18n: I18nType) {
    // If it's directly a localized config, handle it
    if (isLocalizedConfig(value, i18n)) {
        // Handle as a localized config (direct translations)
        const mapped = await mapLocalizedI18nConfig(value);
        i18n.addResourceBundle(
            i18n.language,
            "customized",
            mapped,
            true, // Deep merge
            true // Overwrite
        );
        return;
    }

    // Otherwise, add each language override
    const loadNamespaceAsync = Object.entries(value).map(
        async ([lang, value]) => {
            const mapped = await mapLocalizedI18nConfig(value);
            // Add the resources
            i18n.addResourceBundle(
                lang,
                "customized",
                mapped,
                // Deep override
                true,
                // Overwrite
                true
            );
        }
    );
    // Wait for all the namespaces to be loaded
    await Promise.allSettled(loadNamespaceAsync);
}

type NestedStringRecord = { [key: string]: NestedStringRecord | string };

/**
 * Map an i18n config to a localized i18n config
 * @param value
 * @returns
 */
async function mapLocalizedI18nConfig(value: LocalizedI18nConfig) {
    // The resources we will add
    let resources: NestedStringRecord = typeof value === "string" ? {} : value;
    // If that's a string, that's an url, fetch it
    if (typeof value === "string") {
        try {
            const response = await fetch(value);
            const json = await response.json();
            resources = translationKeyPathToObject(json);
        } catch (e) {
            console.warn("Failed to load custom translation file", e, {
                value,
            });
        }
    }

    // Convert the object to a nested object
    if (typeof value === "object") {
        resources = translationKeyPathToObject(value);
    }

    return resources;
}

/**
 * Convert a translation key path to an object
 *  -> { "key1.text": "value1", "key1.title": "value2", "key2.text": "value3" } -> { "key1": { "text": "value1", "title": "value2" }, "key2": { "text": "value3" } }
 */
export function translationKeyPathToObject(translation: object) {
    return Object.entries(translation).reduce(
        (acc: NestedStringRecord, [key, value]) => {
            const parts = key.split(".");
            let current = acc;

            // Handle all parts except the last one
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                current[part] = current[part] || {};
                current = current[part] as NestedStringRecord;
            }

            // Set the value at the deepest level
            const lastPart = parts[parts.length - 1];
            current[lastPart] = value;

            return acc;
        },
        {}
    );
}

/**
 * Check if a value is a localized i18n config
 * @param value
 * @param i18n
 * @returns
 */
function isLocalizedConfig(
    value: I18nConfig,
    i18n: I18nType
): value is LocalizedI18nConfig {
    return (
        // Check if it's a string (URL to json)
        typeof value === "string" ||
        // Or if it's an object where keys are translation keys (not language codes)
        (typeof value === "object" &&
            Object.keys(value).length > 0 &&
            // If keys don't look like language codes but like translation paths
            !Object.keys(value).some((key) =>
                getKnownLanguageCodes(i18n).includes(key)
            ))
    );
}

/**
 * Resolve the language codes known to this i18n instance.
 *
 * `i18n.languages` is populated only after the async `init()` completes —
 * cloned instances (see `ListenerUiProvider`) are returned synchronously
 * before that happens, so we must fall back to `supportedLngs` / `language`
 * to keep language-code detection working when this runs during a React
 * render right after `cloneInstance`.
 */
function getKnownLanguageCodes(i18n: I18nType): readonly string[] {
    if (i18n.languages?.length) return i18n.languages;
    const supported = i18n.options.supportedLngs;
    if (Array.isArray(supported) && supported.length > 0) return supported;
    return i18n.language ? [i18n.language] : [];
}
