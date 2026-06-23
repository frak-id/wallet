/**
 * Shared i18n locale loader.
 *
 * The translation bundles live in `@frak-labs/wallet-shared/i18n/locales/<lang>`
 * and are dynamic-imported on demand. Multiple code paths can race to load
 * the same locale:
 *
 *  - `bootstrap.ts` — `?preload=...` hint warms the JSON before the first
 *    UI request even arrives.
 *  - `uiRuntime.ts` — `ensureUiRuntime()` (fired by any `frak_display*`
 *    handler) also warms the JSON in parallel with the Ring 1 import.
 *  - `ui/runtime.tsx#mountUiRuntime` — registers the bundle on i18next
 *    after `i18next.init()` and blocks the first React render until the
 *    register succeeds.
 *  - `ui/runtime.tsx`'s `languageChanged` listener — SDK overrides
 *    (`resolved-config.lang`) may switch to a locale that wasn't preloaded.
 *
 * To make all paths share the same work we keep a `Map<lang, Promise>`. The
 * dynamic import is started once per locale, the `addResourceBundle` call
 * runs once per locale, and every call site awaits the same promise.
 */

import type { i18n as I18nType } from "i18next";

type Locale = "en" | "fr";

type Bundle = {
    // biome-ignore lint/suspicious/noExplicitAny: i18next resource bundle shape
    translation: any;
    // biome-ignore lint/suspicious/noExplicitAny: i18next resource bundle shape
    customized: any;
};

const bundlePromises: Map<Locale, Promise<Bundle>> = new Map();
const registrationPromises: Map<Locale, Promise<void>> = new Map();

function loadBundle(lang: Locale): Promise<Bundle> {
    const cached = bundlePromises.get(lang);
    if (cached) return cached;
    const promise =
        lang === "en"
            ? import("@frak-labs/wallet-shared/i18n/locales/en")
            : import("@frak-labs/wallet-shared/i18n/locales/fr");
    bundlePromises.set(lang, promise);
    return promise;
}

function detectBrowserLocale(): Locale {
    if (typeof navigator === "undefined") return "fr";
    return navigator.language?.split("-")[0] === "en" ? "en" : "fr";
}

/**
 * Ring 0 warm-up. No i18next dependency — only dynamic-imports the JSON
 * module so it lands in the browser module cache before Ring 1 mounts.
 *
 * Safe to call from `bootstrap.ts` (eager, React-free) and from
 * `uiRuntime.ts` (also Ring 0). The matching `ensureI18nBundle` call from
 * Ring 1 reuses the same promise — no double fetch.
 */
export function warmI18nLocale(): void {
    void loadBundle(detectBrowserLocale());
}

/**
 * Ring 1 entry. Loads the JSON bundle (or reuses the warm-up promise) and
 * registers it on the i18next instance via `addResourceBundle`. Idempotent
 * per locale — the registration only runs once, every subsequent caller
 * awaits the same promise.
 *
 * Called from:
 *  - `mountUiRuntime` after `i18next.init()` resolves (blocks first render).
 *  - The `languageChanged` listener when the SDK forces a different locale.
 */
export function ensureI18nBundle(lang: string, i18n: I18nType): Promise<void> {
    if (lang !== "en" && lang !== "fr") return Promise.resolve();
    const existing = registrationPromises.get(lang);
    if (existing) return existing;
    const promise = loadBundle(lang).then((bundle) => {
        if (!i18n.hasResourceBundle(lang, "translation")) {
            i18n.addResourceBundle(lang, "translation", bundle.translation);
        }
        if (!i18n.hasResourceBundle(lang, "customized")) {
            i18n.addResourceBundle(lang, "customized", bundle.customized);
        }
    });
    registrationPromises.set(lang, promise);
    return promise;
}

/**
 * Test-only escape hatch to reset both caches between cases.
 */
export function _resetI18nPreloadForTests(): void {
    bundlePromises.clear();
    registrationPromises.clear();
}
