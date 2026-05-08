import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import { initAnalytics } from "@frak-labs/wallet-shared/common/analytics";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    supportedLngs,
} from "@frak-labs/wallet-shared/i18n";
import frCustomized from "@frak-labs/wallet-shared/i18n/locales/fr/customized.json";
import frTranslation from "@frak-labs/wallet-shared/i18n/locales/fr/translation.json";
import { setupBigIntSerialization } from "@frak-labs/wallet-shared/polyfills/bigint-serialization";

// Setup BigInt serialization polyfill
setupBigIntSerialization();

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
    if (lng === "en" && !i18next.hasResourceBundle("en", "translation")) {
        const [enTranslation, enCustomized] = await Promise.all([
            import("@frak-labs/wallet-shared/i18n/locales/en/translation.json"),
            import("@frak-labs/wallet-shared/i18n/locales/en/customized.json"),
        ]);
        i18next.addResourceBundle("en", "translation", enTranslation.default);
        i18next.addResourceBundle("en", "customized", enCustomized.default);
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
        resources: {
            fr: { translation: frTranslation, customized: frCustomized },
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
