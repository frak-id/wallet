import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
} from "react-router";
import { useChangeLanguage } from "remix-i18next/react";
import i18next from "./i18n/i18next.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const locale = await i18next.getLocale(request);
    return { locale };
}

export const handle = {
    i18n: "translation",
};

export default function App() {
    const { locale } = useLoaderData<typeof loader>();
    const { i18n } = useTranslation();
    useChangeLanguage(locale);

    return (
        <html lang={locale} dir={i18n.dir()}>
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width,initial-scale=1"
                />
                <link rel="preconnect" href="https://cdn.shopify.com/" />
                <link
                    rel="stylesheet"
                    href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
                />
                <Meta />
                <Links />
            </head>
            <body>
                <Outlet />
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}
