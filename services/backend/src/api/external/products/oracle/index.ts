import { Elysia } from "elysia";
import { log } from "../../../../common";
import { customWebhook } from "./customWebhook";
import { shopifyWebhook } from "./shopifyWebhook";
import { wooCommerceWebhook } from "./wooCommerceWebhook";

export const oracleWebhook = new Elysia({ prefix: "/oracle" })
    .onBeforeHandle(({ path, headers }) => {
        log.debug({ path, headers }, "Handling oracle webhook");
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
            "Error while handling oracle webhook"
        );
        // We always keep a 200 status code for webhook
        set.status = 200;
        return `ko: ${msg ?? "Unknown error"}`;
    });
