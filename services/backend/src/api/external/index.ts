import { Elysia } from "elysia";
import { instagramWebhookRoutes } from "./instagram";
import { merchantApi } from "./merchant";

export const externalApi = new Elysia({ prefix: "/ext" })
    .use(merchantApi)
    .use(instagramWebhookRoutes);
