import { isRunningInProd } from "@frak-labs/app-essentials";
import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ChainedBackend from "i18next-chained-backend";
import HttpBackend from "i18next-http-backend";

/**
 * Define our main i18n instance
 */
export const mainI18nInstance = createInstance()
    .use(ChainedBackend)
    .use(LanguageDetector);

/**
 * Function to trigger the i18n instance init
 */
export const initI18nInstance = () =>
    mainI18nInstance.init({
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
