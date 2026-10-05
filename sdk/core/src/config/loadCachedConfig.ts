import type { FrakWalletSdkConfig, Language } from "../types/config";
import { detectPageLanguage } from "../utils/i18n/detectPageLanguage";
import { sdkConfigStore } from "./sdkConfigStore";

/**
 * Scope the config store to this page's store and language, and publish what
 * that cache holds. Returns the language, which `/resolve` must reuse so the
 * fresh config lands under the same cache key.
 */
export function loadCachedConfig(
    config: FrakWalletSdkConfig
): Language | undefined {
    // `metadata.lang` → page `<html lang>` → browser language.
    const lang = config.metadata.lang ?? detectPageLanguage();
    const domain =
        config.domain ??
        (typeof window !== "undefined" ? window.location.hostname : "");
    sdkConfigStore.setCacheScope(domain, lang);
    sdkConfigStore.reset();
    return lang;
}
