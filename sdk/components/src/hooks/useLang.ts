import { type Language, sdkConfigStore } from "@frak-labs/core-sdk";
import { useSyncExternalStore } from "preact/compat";
import { subscribeSdkConfig } from "./sdkConfigSubscription";

/**
 * Detect a supported language from the browser, defaulting to English.
 * Only `en` / `fr` are recognised — anything else falls back to `en`.
 */
function detectBrowserLang(): Language {
    if (typeof navigator === "undefined") return "en";
    return navigator.language?.split("-")[0] === "fr" ? "fr" : "en";
}

/**
 * Resolve the active display language for the Web Components.
 *
 * Precedence: resolved SDK/backend config `lang` (driven by `metadata.lang`
 * or the backend `/resolve` response) → browser language → `en`. Backed by
 * `useSyncExternalStore` with a bare-string snapshot, so a `frak:config`
 * dispatch only re-renders the component when the resolved language actually
 * changes (see `@/i18n/defaults`).
 */
export function useLang(): Language {
    return useSyncExternalStore(
        subscribeSdkConfig,
        () => sdkConfigStore.getConfig().lang ?? detectBrowserLang()
    );
}
