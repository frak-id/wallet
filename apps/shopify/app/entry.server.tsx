import { resolve } from "node:path";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { createInstance } from "i18next";
import Backend from "i18next-fs-backend/cjs";
import { isbot } from "isbot";
// Import the Node build explicitly: this server runs on the Bun runtime image,
// and bare `react-dom/server` resolves via Bun's `bun` export condition to
// server.bun.js, which only exports renderToReadableStream (no
// renderToPipeableStream). server.node ships the Node streaming API we use below.
import { renderToPipeableStream } from "react-dom/server.node";
import { I18nextProvider, initReactI18next } from "react-i18next";
import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    resources,
    supportedLngs,
} from "./i18n/config";
import i18next from "./i18n/i18next.server";
import { RequestIdProvider } from "./providers/RequestId";
import { log } from "./services.server/logger";
import { getRequestId } from "./services.server/requestId";
import { addDocumentResponseHeaders } from "./shopify.server";

const ABORT_DELAY = 5000;

// Dedup guard: a shell/document render error reaches BOTH `onError` (the
// renderToPipeableStream callback) and `handleError` (React Router) for the
// same request. Track the error object so it is logged exactly once, whichever
// callback sees it first. WeakSet so entries are GC'd with the error.
const loggedErrors = new WeakSet<object>();

/**
 * Log a request error exactly once, tagged with the ingress correlation id so
 * support can grep the pod logs for `reqId`. Skips aborted requests (client
 * navigated away) to avoid noise.
 */
function logRequestError(error: unknown, request: Request) {
    if (request.signal.aborted) return;
    if (typeof error === "object" && error !== null) {
        if (loggedErrors.has(error)) return;
        loggedErrors.add(error);
    }
    log.error({ err: error, reqId: getRequestId(request) }, "request error");
}

/**
 * Called by React Router for loader/action errors and for document-render
 * errors that reject the request (including shell render errors, via
 * onShellError below).
 */
export function handleError(error: unknown, { request }: { request: Request }) {
    logRequestError(error, request);
}

export default async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext
) {
    addDocumentResponseHeaders(request, responseHeaders);
    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
    const instance = createInstance();
    const lng = await i18next.getLocale(request);
    const ns = i18next.getRouteNamespaces(routerContext);

    await instance
        .use(initReactI18next)
        .use(Backend)
        .init({
            supportedLngs,
            fallbackLng,
            defaultNS,
            resources,
            interpolation,

            lng,
            ns,
            backend: {
                loadPath: resolve("./i18n/locales/{{lng}}/{{ns}}.json"),
            },
        });

    return new Promise((resolve, reject) => {
        const { pipe, abort } = renderToPipeableStream(
            <RequestIdProvider value={getRequestId(request) ?? null}>
                <I18nextProvider i18n={instance}>
                    <ServerRouter context={routerContext} url={request.url} />
                </I18nextProvider>
            </RequestIdProvider>,
            {
                [callbackName]: () => {
                    const body = new PassThrough();
                    const stream = createReadableStreamFromReadable(body);

                    responseHeaders.set("Content-Type", "text/html");
                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        })
                    );
                    pipe(body);
                },
                onShellError(error) {
                    reject(error);
                },
                onError(error) {
                    responseStatusCode = 500;
                    // Also logs bot/onAllReady render errors that never reach
                    // handleError; the shared dedup guard prevents a double log
                    // when the same error also surfaces in handleError.
                    logRequestError(error, request);
                },
            }
        );

        setTimeout(abort, ABORT_DELAY);
    });
}
