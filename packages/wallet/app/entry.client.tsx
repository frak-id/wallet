import {
    defaultNS,
    fallbackLng,
    interpolation,
    resources,
    supportedLngs,
} from "@/i18n/config";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { RemixBrowser } from "@remix-run/react";
import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";

async function main() {
    await i18next
        .use(initReactI18next) // Tell i18next to use the react-i18next plugin
        .use(I18nextBrowserLanguageDetector) // Setup a client-side language detector
        .init({
            defaultNS,
            fallbackLng,
            supportedLngs,
            resources,
            debug: isRunningLocally,
            interpolation,
        });

    startTransition(() => {
        hydrateRoot(
            document,
            <I18nextProvider i18n={i18next}>
                <StrictMode>
                    <RemixBrowser />
                </StrictMode>
            </I18nextProvider>
        );
    });
}

main().catch((error) => console.error(error));
