import i18next from "i18next";

/**
 * Lazy-load the English translation bundle and register it on i18next.
 * Idempotent — safe to call multiple times.
 *
 * The bundle is added via `addResourceBundle` (not the standard backend
 * mechanism) because `partialBundledLanguages: true` is set in init and
 * FR is bundled eagerly. Components re-render on the `added` event when
 * `react: { bindI18nStore: "added" }` is configured in init.
 */
export async function loadEnglishBundle(): Promise<void> {
    if (i18next.hasResourceBundle("en", "translation")) return;
    const { translation } = await import("./locales/en");
    i18next.addResourceBundle("en", "translation", translation);
}
