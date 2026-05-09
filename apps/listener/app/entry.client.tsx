import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import { initAnalytics } from "@frak-labs/wallet-shared/common/analytics";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    supportedLngs,
} from "@frak-labs/wallet-shared/i18n";
import { setupBigIntSerialization } from "@frak-labs/wallet-shared/polyfills/bigint-serialization";

// Setup BigInt serialization polyfill
setupBigIntSerialization();

// ──────────────────────────────────────────────────────────────────────────
// [PREACT-DEBUG] Global error surface
// ──────────────────────────────────────────────────────────────────────────
// During the React→Preact migration we hit silent UI failures whose only
// console signal is `Uncaught (in promise) Promise {<pending>}`. That message
// originates from preact/compat/src/suspense.js: when a lazy component throws
// a Promise and no <Suspense> boundary is found while walking up the vdom,
// the thrown Promise falls through to the default error handler and becomes
// an unhandled rejection. Wire up window-level listeners so we always see
// the full stack + the offending value, instead of just the opaque message.
if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        // eslint-disable-next-line no-console
        console.error(
            "[listener-debug] unhandledrejection",
            {
                isPromise: reason && typeof (reason as { then?: unknown })?.then === "function",
                reasonString: String(reason),
                reason,
            }
        );
    });
    window.addEventListener("error", (event) => {
        // eslint-disable-next-line no-console
        console.error("[listener-debug] window error", {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error,
        });
    });
    // eslint-disable-next-line no-console
    console.log("[listener-debug] entry.client booting", {
        href: window.location.href,
        hash: window.location.hash,
    });
}

// Initialise analytics (OpenPanel + crashlytics globals) once at bootstrap.
// Side-effect was previously triggered by importing the analytics module;
// the explicit call keeps tree-shaking honest in the listener bundle.
initAnalytics();

import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import App from "./root";
import "./styles/all.css";

// Lazy-load the English bundle on demand. French is bundled by default
// (it's our fallbackLng) so most loads avoid pulling EN translations
// (~13 KB gzipped saved). Listener registered before init() so the initial
// `languageChanged` event emitted by the language detector is captured.
i18next.on("languageChanged", async (lng) => {
    if (lng === "fr" && !i18next.hasResourceBundle("fr", "translation")) {
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
    .use(initReactI18next) // Tell i18next to use the react-i18next plugin
    .use(I18nextBrowserLanguageDetector) // Setup a client-side language detector
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
