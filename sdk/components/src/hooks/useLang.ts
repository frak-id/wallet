import {
    type Language,
    type SdkResolvedConfig,
    sdkConfigStore,
} from "@frak-labs/core-sdk";
import { useEffect, useMemo, useState } from "preact/hooks";

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
 * Precedence: resolved SDK/backend config `lang` (driven by
 * `metadata.lang` or the backend `/resolve` response) → browser language →
 * `en`. Re-renders on the `frak:config` event so a late, backend-driven
 * language switch updates the built-in default copy (see
 * `@/i18n/defaults`).
 */
export function useLang(): Language {
    const [configVersion, setConfigVersion] = useState(0);

    useEffect(() => {
        const onConfig = (_e: CustomEvent<SdkResolvedConfig>) => {
            setConfigVersion((v) => v + 1);
        };
        window.addEventListener("frak:config", onConfig);
        // Re-check in case the event fired between render and effect mount
        setConfigVersion((v) => v + 1);
        return () => window.removeEventListener("frak:config", onConfig);
    }, []);

    return useMemo(
        () => sdkConfigStore.getConfig().lang ?? detectBrowserLang(),
        [configVersion]
    );
}
