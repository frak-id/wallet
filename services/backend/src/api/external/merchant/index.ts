import { Elysia } from "elysia";
import { webhookRoutes } from "./webhook";

export const merchantApi = new Elysia({ prefix: "/merchant" }).group(
    "/:merchantId/webhook",
    (app) => app.use(webhookRoutes)
);
