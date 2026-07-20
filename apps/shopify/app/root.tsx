import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppError } from "app/components/AppError";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs, MiddlewareFunction } from "react-router";
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useRouteError,
    useRouteLoaderData,
} from "react-router";
import i18next from "./i18n/i18next.server";
import { useRequestId } from "./providers/RequestId";
import { runWithRequestContext } from "./services.server/logger";
import { getRequestId } from "./services.server/requestId";

/**
 * Bind the per-request logging context (correlation id + route) for the whole
 * request lifecycle so every structured log line emitted by downstream
 * loaders/actions/services carries `reqId`/`route` (and `shop`/`merchantId`
 * once a loader resolves them via `setRequestContext`). Runs on the server for
 * every matched route since root is always in the match chain.
 */
export const middleware: MiddlewareFunction[] = [
    ({ request }, next) => {
        const url = new URL(request.url);
        return runWithRequestContext(
            { reqId: getRequestId(request), route: url.pathname },
            () => next()
        );
    },
];

export async function loader({ request }: LoaderFunctionArgs) {
    const locale = await i18next.getLocale(request);
    // Boundaries read this via `useRouteLoaderData("root")` (root never throws).
    // `?? null`: keeps the payload serializable; absent → AppError omits it.
    return { locale, requestId: getRequestId(request) ?? null };
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
    // Prefer root's loader data (present when a child route threw), but fall
    // back to the request-scoped id from context so the reference is still
    // shown when the root loader ITSELF threw (its data is gone) — exactly the
    // case where correlation matters most. `data-frak-req-id` echoes it so the
    // client hydrates with the same value.
    const loaderRequestId =
        useRouteLoaderData<typeof loader>("root")?.requestId;
    const contextRequestId = useRequestId();
    const requestId = loaderRequestId ?? contextRequestId;
    // Thrown Responses (OAuth / session-token redirects with App Bridge
    // headers) must keep flowing through Shopify's boundary so the redirect
    // and required headers are emitted — never paint them as an error page.
    if (isRouteErrorResponse(error)) {
        return boundary.error(error);
    }
    return (
        <html lang="en" data-frak-req-id={requestId ?? undefined}>
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
                <AppError error={error} requestId={requestId} />
                <Scripts />
            </body>
        </html>
    );
}
