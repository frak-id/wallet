import type { I18nConfig, LocalizedI18nConfig } from "@frak-labs/core-sdk";
import { translationKeyPathToObject } from "@frak-labs/wallet-shared/common/utils/translationKeyPathToObject";
import type { i18n as I18nType } from "i18next";

/**
 * Map an i18n config to a localized i18n config
 */
export async function mapI18nConfig(value: I18nConfig, i18n: I18nType) {
    // If it's directly a localized config, handle it
    if (isLocalizedConfig(value, i18n)) {
        // Handle as a localized config (direct translations)
        const mapped = await mapLocalizedI18nConfig(value);
        addCustomizedResources(i18n, i18n.language, mapped);
        return;
    }

    // Otherwise, add each language override
    const loadNamespaceAsync = Object.entries(value).map(
        async ([lang, value]) =>
            addCustomizedResources(
                i18n,
                lang,
                await mapLocalizedI18nConfig(value)
            )
    );
    // Wait for all the namespaces to be loaded
    await Promise.allSettled(loadNamespaceAsync);
}

/**
 * Deep-merge caller supplied translations into the `customized` namespace, given either
 * flat key paths or an already nested object.
 */
export function addCustomizedResources(
    i18n: I18nType,
    lang: string,
    translations: Record<string, unknown>
) {
    const overrides = translationKeyPathToObject(translations);
    const defaults = i18n.getResourceBundle(lang, "customized");
    i18n.addResourceBundle(
        lang,
        "customized",
        dropSubtreeOverrides(overrides, defaults),
        // Deep merge
        true,
        // Overwrite
        true
    );
}

/**
 * A string override on a key that defaults to a subtree replaces the whole subtree, and
 * every child then renders as its raw key path — a merchant setting
 * `sdk.sharingPage.steps.1` blanks the `steps.1.title` the page reads. Keep the default.
 */
function dropSubtreeOverrides(
    overrides: NestedStringRecord,
    defaults: NestedStringRecord | undefined
): NestedStringRecord {
    if (!defaults) return overrides;

    const kept: NestedStringRecord = {};
    for (const [key, value] of Object.entries(overrides)) {
        const fallback = defaults[key];
        if (!isRecord(fallback)) {
            kept[key] = value;
        } else if (isRecord(value)) {
            kept[key] = dropSubtreeOverrides(value, fallback);
        }
    }
    return kept;
}

function isRecord(value: unknown): value is NestedStringRecord {
    return typeof value === "object" && value !== null;
}

type NestedStringRecord = { [key: string]: NestedStringRecord | string };

/**
 * Map a localized i18n config (inline object, or a URL to fetch) to resources.
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
 * Check if a value is a localized i18n config
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
