import { isRunningLocally } from "@frak-labs/app-essentials";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    resources,
    setupBigIntSerialization,
    supportedLngs,
} from "@frak-labs/wallet-shared";

// Setup BigInt serialization polyfill
setupBigIntSerialization();

import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import App from "./root";
import "./styles/all.css";

// Kick off i18next in parallel with the React render. `resources` are bundled
// and all configured detectors are synchronous, so `init()` completes on the
// next microtask; by that point `react-i18next` has subscribed to the
// "initialized" event and will re-render consumers. `useSuspense: false` keeps
// `useTranslation` from suspending if it's ever called before init completes.
i18next
    .use(initReactI18next) // Tell i18next to use the react-i18next plugin
    .use(I18nextBrowserLanguageDetector) // Setup a client-side language detector
    .init({
        defaultNS,
        ns: ["translation", "customized"],
        fallbackLng,
        fallbackNS: "customized",
        supportedLngs,
        resources,
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
