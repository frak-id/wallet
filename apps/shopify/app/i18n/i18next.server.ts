import { resolve } from "node:path";
import Backend from "i18next-fs-backend/cjs";
import { RemixI18Next } from "remix-i18next/server";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    resources,
    supportedLngs,
} from "./config";

const i18next = new RemixI18Next({
    detection: {
        supportedLanguages: supportedLngs,
        fallbackLanguage: fallbackLng,
        async findLocale(request) {
            // Find locale from the request of Shopify iframe
            const locale = new URL(request.url).searchParams.get("locale");
            return locale;
        },
    },
    i18next: {
        supportedLngs,
        fallbackLng,
        defaultNS,
        resources,
        interpolation,
        backend: {
            loadPath: resolve("./locales/{{lng}}/{{ns}}.json"),
        },
    },
    plugins: [Backend],
});

export default i18next;
