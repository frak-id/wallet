import { businessMetrics, log } from "@backend-infrastructure";
import { Elysia } from "elysia";
import { customWebhook } from "./customWebhook";
import { magentoWebhook } from "./magentoWebhook";
import { shopifyWebhook } from "./shopifyWebhook";
import { wooCommerceWebhook } from "./wooCommerceWebhook";

export const webhookRoutes = new Elysia()
    .onBeforeHandle(({ path }) => {
        log.debug({ path }, "Handling purchase webhook");
    })
    .use(shopifyWebhook)
    .use(wooCommerceWebhook)
    .use(magentoWebhook)
    .use(customWebhook)
    .onError(({ error, code, path, set }) => {
        const msg = "message" in error ? error.message : undefined;
        log.error(
            {
                error,
                errorMsg: msg,
                code,
                reqPath: path,
            },
            "Error while handling purchase webhook"
        );
        businessMetrics.webhookError();
        set.status = 200;
        return `ko: ${msg ?? "Unknown error"}`;
    });
