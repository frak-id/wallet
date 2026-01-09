import { Elysia } from "elysia";
import { oracleWebhook } from "./oracle";

export const productsApi = new Elysia({ prefix: "/products" }).group(
    "/:identifier/webhook",
    (app) => app.use(oracleWebhook)
);
