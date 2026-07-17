import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { HydratedRouter } from "react-router/dom";
import { getInitialNamespaces } from "remix-i18next/client";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    resources,
    supportedLngs,
} from "./i18n/config";
import { RequestIdProvider } from "./providers/RequestId";

async function hydrate() {
    await i18next
        .use(initReactI18next)
        .use(LanguageDetector)
        .use(Backend)
        .init({
            supportedLngs,
            fallbackLng,
            defaultNS,
            resources,
            interpolation,

            ns: getInitialNamespaces(),
            backend: {
                loadPath: "/i18n/locales/{{lng}}/{{ns}}.json",
            },
            detection: {
                order: ["htmlTag"],
                caches: [],
            },
        });

    // On an SSR error page the boundary echoes the correlation id onto
    // <html data-frak-req-id>; re-read it so the client provider matches the
    // server value (no hydration mismatch). Absent on normal pages → null.
    const requestId = document.documentElement.getAttribute("data-frak-req-id");

    startTransition(() => {
        hydrateRoot(
            document,
            <RequestIdProvider value={requestId}>
                <I18nextProvider i18n={i18next}>
                    <StrictMode>
                        <HydratedRouter />
                    </StrictMode>
                </I18nextProvider>
            </RequestIdProvider>
        );
    });
}

if (window.requestIdleCallback) {
    window.requestIdleCallback(hydrate);
} else {
    // Safari doesn't support requestIdleCallback
    // <https://caniuse.com/requestidlecallback>
    window.setTimeout(hydrate, 1);
}
