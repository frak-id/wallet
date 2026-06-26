import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppError } from "app/components/AppError";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useRouteError,
} from "react-router";
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

    useEffect(() => {
        i18n.changeLanguage(locale);
    }, [locale, i18n]);

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

// Catch-all boundary for anything that escapes a child route's own
// ErrorBoundary (or errors in the root loader itself). Renders its own HTML
// document because the root component — which normally provides the shell — is
// replaced when this boundary is active.
export function ErrorBoundary() {
    const error = useRouteError();
    // Thrown Responses (OAuth / session-token redirects with App Bridge
    // headers) must keep flowing through Shopify's boundary so the redirect
    // and required headers are emitted — never paint them as an error page.
    if (isRouteErrorResponse(error)) {
        return boundary.error(error);
    }
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width,initial-scale=1"
                />
                <title>Frak</title>
                <Meta />
                <Links />
            </head>
            <body>
                <AppError error={error} />
                <Scripts />
            </body>
        </html>
    );
}
