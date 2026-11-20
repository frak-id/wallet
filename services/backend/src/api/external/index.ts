import { Elysia } from "elysia";
import { instagramWebhookRoutes } from "./instagram";
import { merchantApi } from "./merchant";
import { paymentWebhookRoutes } from "./payments";

export const externalApi = new Elysia({ prefix: "/ext" })
    .use(merchantApi)
    .use(instagramWebhookRoutes)
    .use(paymentWebhookRoutes);
