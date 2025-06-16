import type { BodyInit } from "bun";
import type Elysia from "elysia";
import { error } from "elysia";
import { log } from "./common";

/**
 * Map legacy routes to the new ones, using the existing controllers
 */
export const legacyRouteMapper = (app: Elysia) =>
    app.all(
        "*",
        async ({ path, headers, request, body }) => {
            // Redirect previous domain based routes to the new ones
            const newPath = pathMapper(path);
            if (!newPath) {
                return error(404, "Not found");
            }

            // Construct the new path for the webhook handler
            const newUrl = new URL(newPath, `http://${headers.host}`);
            log.debug(
                {
                    path,
                    newUrl: newUrl.toString(),
                    headers,
                },
                "Handling legacy route, calling the new controller via the app invocation"
            );

            // Create a new request with the updated path
            const newRequest = new Request(newUrl.toString(), {
                method: request.method,
                headers: request.headers,
                // @ts-ignore: idk why but dashboard isn't happy with that during typecheck
                body: body as BodyInit | undefined,
                mode: request.mode,
                referrer: request.referrer,
                referrerPolicy: request.referrerPolicy,
                credentials: request.credentials,
            });

            // Let the external api handle the request
            return await app.handle(newRequest);
        },
        {
            parse: "text",
        }
    );

/**
 * Map legacy routes to the new ones
 * @param path - The path to map
 * @returns The new path
 */
function pathMapper(path: string) {
    // interactions/listenForPurchase -> wallet/interactions/listenForPurchase
    if (path.startsWith("/interactions/listenForPurchase")) {
        return "/wallet/interactions/listenForPurchase";
    }

    // interactions/webhook/{productId}/{action} -> ext/products/{productId}/webhook/interactions/{action}
    if (path.startsWith("/interactions/webhook/")) {
        const productId = path.split("/")[3];
        const action = path.split("/")[4];
        return `/ext/products/${productId}/webhook/interactions/${action}`;
    }

    // oracle/{type}/{productId}/hook -> ext/products/{productId}/webhook/oracle/{type}
    if (path.startsWith("/oracle") && path.endsWith("/hook")) {
        const type = path.split("/")[2];
        const productId = path.split("/")[3];
        return `/ext/products/${productId}/webhook/oracle/${type}`;
    }

    throw null;
}
