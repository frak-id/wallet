import { resolve } from "node:path";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { createInstance } from "i18next";
import Backend from "i18next-fs-backend/cjs";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
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
import { addDocumentResponseHeaders } from "./shopify.server";

const ABORT_DELAY = 5000;

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
            <I18nextProvider i18n={instance}>
                <ServerRouter context={routerContext} url={request.url} />
            </I18nextProvider>,
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
                    console.error(error);
                },
            }
        );

        setTimeout(abort, ABORT_DELAY);
    });
}
