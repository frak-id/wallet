import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import {
    initAnalytics,
    recordError,
} from "@frak-labs/wallet-shared/common/analytics";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    supportedLngs,
} from "@frak-labs/wallet-shared/i18n";
import {
    common as frCommon,
    customized as frCustomized,
    translation as frTranslation,
} from "@frak-labs/wallet-shared/i18n/locales/fr/standalone";
import { setupBigIntSerialization } from "@frak-labs/wallet-shared/polyfills/bigint-serialization";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";

// Import global styles — the standalone pages ship their own stylesheet, not
// the SPA's single bundled one.
import "@frak-labs/design-system/global";

/**
 * Boot for the standalone `/sharing` and `/install` pages.
 *
 * These two pages are opened as full-page loads by the web, iOS and Android
 * SDKs, need no blockchain, no smart account, no wallet session beyond a
 * token check, and no router. So they get their own entrypoints instead of
 * the SPA shell: no wagmi, no viem/permissionless, no TanStack Router, no
 * query persistence, no service worker, no Tauri bridges.
 *
 * Anything added here is paid for by every SDK-driven sheet open, so keep it
 * to what both pages genuinely need — `vite.standalone.config.ts` enforces a
 * gzipped boot budget that fails the build when this grows.
 */

/**
 * No persister, unlike the SPA: these pages are single-shot, their queries are
 * cheap, and `localStorage` rehydration would cost more than the refetch.
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
        },
    },
});

/** Report module-eval, render and async failures the same way the SPA does. */
function wireErrorReporting() {
    window.addEventListener("error", (event) => {
        recordError(event.error ?? event.message, {
            source: "window_error",
            context: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            },
        });
    });
    window.addEventListener("unhandledrejection", (event) => {
        recordError(event.reason, { source: "unhandled_rejection" });
    });
}

/**
 * i18next with only the three key trees these pages read (see
 * `wallet-shared/i18n/locales/*\/standalone.ts`). French is bundled because it
 * is the fallback language; English is fetched on demand, exactly as in the
 * SPA.
 */
async function initI18n() {
    // Registered before `init()` so the detector's initial `languageChanged`
    // is captured rather than missed.
    i18next.on("languageChanged", async (lng) => {
        if (lng !== "en" || i18next.hasResourceBundle("en", "translation")) {
            return;
        }
        const { translation, customized, common } = await import(
            "@frak-labs/wallet-shared/i18n/locales/en/standalone"
        );
        i18next.addResourceBundle("en", "translation", translation);
        i18next.addResourceBundle("en", "customized", customized);
        i18next.addResourceBundle("en", "common", common);
    });

    await i18next
        .use(initReactI18next)
        .use(I18nextBrowserLanguageDetector)
        .init({
            defaultNS,
            ns: ["translation", "customized", "common"],
            fallbackLng,
            fallbackNS: ["customized", "common"],
            supportedLngs,
            partialBundledLanguages: true,
            resources: {
                fr: {
                    translation: frTranslation,
                    customized: frCustomized,
                    common: frCommon,
                },
            },
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
            react: {
                // The English bundle is added AFTER `languageChanged` fires, and
                // react-i18next's default only listens to that event — without this an
                // English device renders the French fallback and never re-renders.
                bindI18nStore: "added",
            },
        });
}

/**
 * Mount `page` into `#root` with the providers both standalone pages need.
 * Rejects only when the document is malformed; every other failure is reported
 * through `recordError` and left to the page's own empty state.
 */
export async function bootstrapStandalonePage(page: ReactNode): Promise<void> {
    setupBigIntSerialization();
    initAnalytics();
    wireErrorReporting();

    await initI18n();

    const rootElement = document.getElementById("root");
    if (!rootElement) {
        throw new Error("Root element not found");
    }

    createRoot(rootElement).render(
        <StrictMode>
            <I18nextProvider i18n={i18next}>
                <QueryClientProvider client={queryClient}>
                    {page}
                </QueryClientProvider>
            </I18nextProvider>
        </StrictMode>
    );
}

/** Shared failure path: a boot that throws must still be reported. */
export function reportBootstrapFailure(error: unknown) {
    recordError(error, { source: "bootstrap" });
}
