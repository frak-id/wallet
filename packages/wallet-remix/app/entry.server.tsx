import { PassThrough } from "node:stream";

import {
    defaultNS,
    fallbackLng,
    resources,
    supportedLngs,
} from "@/i18n/config";
import i18nServer from "@/i18n/i18n.server";
import type { AppLoadContext, EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { createInstance, type i18n as i18next } from "i18next";
import * as isbotModule from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { I18nextProvider, initReactI18next } from "react-i18next";

const ABORT_DELAY = 5_000;

export default async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext,
    loadContext: AppLoadContext
) {
    const instance = createInstance();
    const lng = await i18nServer.getLocale(request);
    const ns = i18nServer.getRouteNamespaces(remixContext);

    await instance
        .use(initReactI18next)
        .init({ supportedLngs, fallbackLng, defaultNS, resources, lng, ns });

    const prohibitOutOfOrderStreaming =
        isBotRequest(request.headers.get("user-agent")) ||
        remixContext.isSpaMode;

    return prohibitOutOfOrderStreaming
        ? handleBotRequest(
              request,
              responseStatusCode,
              responseHeaders,
              remixContext,
              loadContext,
              instance
          )
        : handleBrowserRequest(
              request,
              responseStatusCode,
              responseHeaders,
              remixContext,
              loadContext,
              instance
          );
}

// We have some Remix apps in the wild already running with isbot@3 so we need
// to maintain backwards compatibility even though we want new apps to use
// isbot@4.  That way, we can ship this as a minor Semver update to @remix-run/dev.
function isBotRequest(userAgent: string | null) {
    if (!userAgent) {
        return false;
    }

    // isbot >= 3.8.0, >4
    if ("isbot" in isbotModule && typeof isbotModule.isbot === "function") {
        return isbotModule.isbot(userAgent);
    }

    // isbot < 3.8.0
    if ("default" in isbotModule && typeof isbotModule.default === "function") {
        // @ts-ignore
        return isbotModule.default(userAgent);
    }

    return false;
}

function handleBotRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext,
    _loadContext: AppLoadContext,
    i18next: i18next
) {
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const { pipe, abort } = renderToPipeableStream(
            <I18nextProvider i18n={i18next}>
                <RemixServer
                    context={remixContext}
                    url={request.url}
                    abortDelay={ABORT_DELAY}
                />
            </I18nextProvider>,
            {
                onAllReady() {
                    shellRendered = true;
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
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    // biome-ignore lint/style/noParameterAssign: Remix default
                    responseStatusCode = 500;
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        console.error(error);
                    }
                },
            }
        );

        setTimeout(abort, ABORT_DELAY);
    });
}

function handleBrowserRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    remixContext: EntryContext,
    _loadContext: AppLoadContext,
    i18next: i18next
) {
    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const { pipe, abort } = renderToPipeableStream(
            <I18nextProvider i18n={i18next}>
                <RemixServer
                    context={remixContext}
                    url={request.url}
                    abortDelay={ABORT_DELAY}
                />
            </I18nextProvider>,
            {
                onShellReady() {
                    shellRendered = true;
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
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    // biome-ignore lint/style/noParameterAssign: Remix default
                    responseStatusCode = 500;
                    // Log streaming rendering errors from inside the shell.  Don't log
                    // errors encountered during initial shell rendering since they'll
                    // reject and get logged in handleDocumentRequest.
                    if (shellRendered) {
                        console.error(error);
                    }
                },
            }
        );

        setTimeout(abort, ABORT_DELAY);
    });
}
