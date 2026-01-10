import { log } from "@backend-infrastructure";
import type Elysia from "elysia";
import { status } from "elysia";

export const legacyRouteMapper = (app: Elysia) =>
    app.all(
        "*",
        async ({ path, headers, request, body }) => {
            const newPath = pathMapper(path);
            if (!newPath) {
                return status(404, "Not found");
            }

            const newUrl = new URL(newPath, `http://${headers.host}`);
            log.debug(
                {
                    path,
                    newUrl: newUrl.toString(),
                    headers,
                },
                "Handling legacy route, calling the new controller via the app invocation"
            );

            const newRequest = new Request(newUrl.toString(), {
                method: request.method,
                headers: request.headers,
                body: (body as string | null) || null,
                mode: request.mode,
                referrer: request.referrer,
                referrerPolicy: request.referrerPolicy,
                credentials: request.credentials,
            });

            const response = await app.handle(newRequest);

            const headersToStrip = [
                "access-control-allow-origin",
                "access-control-allow-credentials",
                "access-control-allow-headers",
                "access-control-allow-methods",
                "access-control-allow-origin",
            ];
            const newHeaders = new Headers();
            for (const [key, value] of response.headers.entries()) {
                if (!headersToStrip.includes(key)) {
                    newHeaders.set(key, value);
                }
            }

            return new Response(response.body, {
                status: response.status,
                headers: newHeaders,
            });
        },
        {
            parse: "text",
        }
    );

function pathMapper(path: string) {
    // Legacy: oracle/{type}/{productId}/hook -> ext/merchant/{productId}/webhook/{type}
    if (path.startsWith("/oracle") && path.endsWith("/hook")) {
        const type = path.split("/")[2];
        const productId = path.split("/")[3];
        return `/ext/merchant/${productId}/webhook/${type}`;
    }

    // Legacy: /ext/products/{productId}/webhook/oracle/{type} -> /ext/merchant/{productId}/webhook/{type}
    const productsWebhookMatch = path.match(
        /^\/ext\/products\/([^/]+)\/webhook\/oracle\/(.+)$/
    );
    if (productsWebhookMatch) {
        const [, productId, type] = productsWebhookMatch;
        return `/ext/merchant/${productId}/webhook/${type}`;
    }

    // /interactions/listenForPurchase -> /user/track/purchase
    if (path === "/interactions/listenForPurchase") {
        return "/user/track/purchase";
    }

    return null;
}
