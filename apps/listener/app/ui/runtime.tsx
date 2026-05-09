/**
 * Ring 1 entry point: Preact + i18next + provider tree.
 *
 * Imported lazily (dynamic `import("@/ui/runtime")`) the first time the iframe
 * needs to display UI. Importing this module pulls preact, i18next,
 * react-i18next, @tanstack/react-query, and the provider stack — none of
 * which are needed by the headless RPC handlers in Ring 0.
 */

import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    supportedLngs,
} from "@frak-labs/wallet-shared/i18n";
import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import App from "@/root";
import "@/styles/all.css";

let mounted = false;

/**
 * Mount the Preact UI runtime exactly once. Subsequent calls are no-ops so
 * a partner site that fires multiple `frak_displayModal` calls in quick
 * succession does not trigger duplicate roots.
 */
export function mountUiRuntime(): void {
    if (mounted) return;
    mounted = true;

    // Lazy-load the English bundle on demand. French is bundled by default
    // (it's our fallbackLng) so most loads avoid pulling EN translations
    // (~13 KB gzipped saved). Listener registered before init() so the initial
    // `languageChanged` event emitted by the language detector is captured.
    i18next.on("languageChanged", async (lng) => {
        if (
            lng === "fr" &&
            !i18next.hasResourceBundle("fr", "translation")
        ) {
            const { translation, customized } = await import(
                "@frak-labs/wallet-shared/i18n/locales/fr"
            );
            i18next.addResourceBundle("fr", "translation", translation);
            i18next.addResourceBundle("fr", "customized", customized);
            return;
        }

        // Otherwise, if we didn't loaded en translation, load them
        if (!i18next.hasResourceBundle("en", "translation")) {
            const { translation, customized } = await import(
                "@frak-labs/wallet-shared/i18n/locales/en"
            );
            i18next.addResourceBundle("en", "translation", translation);
            i18next.addResourceBundle("en", "customized", customized);
            return;
        }
    });

    // Kick off i18next in parallel with the React render. The bundled French
    // resources resolve synchronously; English is added later via the listener
    // above. `react-i18next` re-renders consumers when `addResourceBundle`
    // fires its `added` event. `useSuspense: false` keeps `useTranslation`
    // from suspending if it's ever called before init completes.
    i18next
        .use(initReactI18next)
        .use(I18nextBrowserLanguageDetector)
        .init({
            defaultNS,
            ns: ["translation", "customized"],
            fallbackLng,
            fallbackNS: "customized",
            supportedLngs,
            partialBundledLanguages: true,
            debug: isRunningLocally,
            interpolation,

            detection: {
                order: [
                    "querystring",
                    "cookie",
                    "sessionStorage",
                    "localStorage",
                    "navigator",
                ],
            },
            react: { useSuspense: false },
        });

    const root = document.getElementById("root");
    if (!root) {
        throw new Error("Root element not found");
    }

    createRoot(root).render(
        <I18nextProvider i18n={i18next}>
            <StrictMode>
                <App />
            </StrictMode>
        </I18nextProvider>
    );
}
