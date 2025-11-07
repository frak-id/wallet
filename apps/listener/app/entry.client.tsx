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

async function main() {
    await i18next
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

main().catch((error) => console.error(error));
