import { RemixI18Next } from "remix-i18next/server";

import { createCookie } from "@remix-run/node";
import { defaultNS, fallbackLng, resources, supportedLngs } from "./config";

export const localeCookie = createCookie("lng", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
});

export default new RemixI18Next({
    detection: {
        supportedLanguages: supportedLngs,
        fallbackLanguage: fallbackLng,
        cookie: localeCookie,
    },
    // This is the configuration for i18next used
    // when translating messages server-side only
    i18next: {
        supportedLngs,
        fallbackLng,
        defaultNS,
        resources,
    },
});
