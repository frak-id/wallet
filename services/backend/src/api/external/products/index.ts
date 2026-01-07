import { Elysia } from "elysia";
import { oracleWebhook } from "./oracle";

export const productsApi = new Elysia({ prefix: "/products" }).group(
    "/:productId/webhook",
    (app) => app.use(oracleWebhook)
);
