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
import { drainPendingI18nOverrides } from "@/i18nOverrideQueue";
import { ensureI18nBundle } from "@/i18nPreload";
import { useListenerDataPreload } from "@/module/hooks/useListenerDataPreload";
import { ListenerUiProvider } from "@/ui/ListenerUiProvider";
import { ListenerUiRenderer } from "@/ui/ListenerUiRenderer";
import { RootProvider } from "@/ui/RootProvider";
import "@/styles/all.css";

let mounted = false;

/**
 * Mount the Preact UI runtime exactly once. Subsequent calls are no-ops so
 * a partner site that fires multiple `frak_displayModal` calls in quick
 * succession does not trigger duplicate roots.
 *
 * Returns a promise so callers (tests) can await mount completion. Production
 * callers fire-and-forget — the `mounted` flag prevents double mounts.
 */
export async function mountUiRuntime(): Promise<void> {
    if (mounted) return;
    mounted = true;

    // Init i18next first so the detector resolves the active language and
    // the React bindings are wired up. Then await the locale bundle
    // registration (shared promise — reuses the warm-up fetch kicked off
    // from `bootstrap.ts`/`uiRuntime.ts`). Only then mount the React tree,
    // so the first paint never sees raw translation keys.
    await initI18n();
    await ensureI18nBundle(i18next.language, i18next);

    drainPendingI18nOverrides(i18next);

    const root = document.getElementById("root");
    if (!root) {
        throw new Error("Root element not found");
    }

    createRoot(root).render(
        <I18nextProvider i18n={i18next}>
            <StrictMode>
                <RootProvider>
                    <ListenerUiProvider>
                        <ListenerHost />
                    </ListenerUiProvider>
                </RootProvider>
            </StrictMode>
        </I18nextProvider>
    );
}

/**
 * Inner host that runs Ring-1-only side effects (SDK session warmup) and
 * renders the request-driven UI. Lives here rather than in
 * `ListenerUiRenderer` because those side effects need React, while the
 * renderer itself is happy as a pure component.
 */
function ListenerHost() {
    useListenerDataPreload();
    return <ListenerUiRenderer />;
}

async function initI18n(): Promise<void> {
    // Subsequent language switches (SDK `resolved-config.lang` overrides, or
    // any explicit `changeLanguage` call) reuse the same shared loader so
    // the JSON for the new locale is only fetched + registered once. Fire-
    // and-forget here is fine: the shared promise dedupes concurrent calls
    // and the listener doesn't gate render.
    i18next.on("languageChanged", (lng) => {
        void ensureI18nBundle(lng, i18next);
    });

    await i18next
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
}
