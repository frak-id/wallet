import { isRunningInProd } from "@frak-labs/app-essentials";
import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ChainedBackend from "i18next-chained-backend";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

/**
 * The i18n configuration
 *  todo: Maybe a cleaner way possible with a context provider etc?
 *  todo: Typing to fix
 */
export default i18next
    .use(ChainedBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        supportedLngs: ["en", "fr"],
        fallbackLng: "en",
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        debug: !isRunningInProd,
        defaultNS: "translation",
        backend: {
            // Local storage backend for caching + regular http one to fetch from public folder
            backends: [
                // LocalStorageBackend,
                HttpBackend,
            ],
            backendOptions: [
                // todo: Local storage chain disabled for now
                // {
                //     expirationTime: 24 * 60 * 60 * 1000,
                //     prefix: "frak_i18n_res_",
                // },
                {
                    loadPath: "/locales/{{lng}}/{{ns}}.json",
                },
            ],
        },
    });
