import { RouterProvider } from "@tanstack/react-router";
import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    supportedLngs,
} from "./i18n/config";
import { loadEnglishBundle } from "./i18n/loadBundle";
import { translation as frTranslation } from "./i18n/locales/fr";
import { getRouter } from "./router";

const router = getRouter();

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}

async function main() {
    await i18next
        .use(initReactI18next)
        .use(I18nextBrowserLanguageDetector)
        .init({
            defaultNS,
            ns: ["translation"],
            fallbackLng,
            supportedLngs,
            partialBundledLanguages: true,
            resources: {
                fr: {
                    translation: frTranslation,
                },
            },
            debug: import.meta.env.DEV,
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
                // Re-render components when a resource bundle is added (e.g. the
                // lazy-loaded EN bundle). Without this, react-i18next only
                // listens to `languageChanged`, which fires BEFORE our async
                // bundle load completes — so the UI is stuck on the FR
                // fallback when a user switches to EN at runtime.
                bindI18nStore: "added",
            },
        });

    // Detector resolved a language by the time `init()` returned. If it's EN,
    // block first render on the EN bundle so the user never sees the FR
    // fallback flash before EN strings hydrate.
    if (i18next.language?.startsWith("en")) {
        await loadEnglishBundle();
    }

    // Safety net: covers runtime paths that change the language WITHOUT
    // pre-loading the EN bundle first (e.g. `?lng=en` deep links). The
    // LanguageSelector itself preloads before calling `changeLanguage`, so
    // no flash for that path.
    i18next.on("languageChanged", (lng) => {
        if (lng === "en") void loadEnglishBundle();
    });

    const rootElement = document.getElementById("root");
    if (!rootElement) {
        throw new Error("Root element not found");
    }

    startTransition(() => {
        const root = createRoot(rootElement);
        root.render(
            <I18nextProvider i18n={i18next}>
                <StrictMode>
                    <RouterProvider router={router} />
                </StrictMode>
            </I18nextProvider>
        );
    });
}

main().catch((error) => console.error(error));
