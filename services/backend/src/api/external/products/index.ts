import { Elysia } from "elysia";
import { interactionsApi } from "./interactions";
import { oracleWebhook } from "./oracle";

export const productsApi = new Elysia({ prefix: "/products" }).group(
    "/:productId/webhook",
    (app) => app.use(interactionsApi).use(oracleWebhook)
);
