import { log } from "@backend-infrastructure";
import { Elysia } from "elysia";
import { customWebhook } from "./customWebhook";
import { shopifyWebhook } from "./shopifyWebhook";
import { wooCommerceWebhook } from "./wooCommerceWebhook";

export const webhookRoutes = new Elysia()
    .onBeforeHandle(({ path, headers }) => {
        log.debug({ path, headers }, "Handling purchase webhook");
    })
    .use(shopifyWebhook)
    .use(wooCommerceWebhook)
    .use(customWebhook)
    .onError(({ error, code, path, headers, set }) => {
        const msg = "message" in error ? error.message : undefined;
        log.error(
            {
                error,
                errorMsg: msg,
                code,
                reqPath: path,
                reqHeaders: headers,
            },
            "Error while handling purchase webhook"
        );
        set.status = 200;
        return `ko: ${msg ?? "Unknown error"}`;
    });
