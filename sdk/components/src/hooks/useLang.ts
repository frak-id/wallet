import {
    detectPageLanguage,
    type Language,
    sdkConfigStore,
} from "@frak-labs/core-sdk";
import { useSyncExternalStore } from "preact/compat";
import { subscribeSdkConfig } from "./sdkConfigSubscription";

/**
 * Resolve the active display language for the Web Components.
 *
 * Precedence: resolved SDK/backend config `lang` (driven by `metadata.lang`
 * or the backend `/resolve` response) → page `<html lang>` → browser
 * language → `en`. Backed by `useSyncExternalStore` with a bare-string
 * snapshot, so a `frak:config` dispatch only re-renders the component when
 * the resolved language actually changes (see `@/i18n/defaults`).
 */
export function useLang(): Language {
    return useSyncExternalStore(
        subscribeSdkConfig,
        () => sdkConfigStore.getConfig().lang ?? detectPageLanguage() ?? "en"
    );
}
