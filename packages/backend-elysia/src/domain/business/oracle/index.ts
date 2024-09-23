import Elysia from "elysia";
import { managmentRoutes } from "./routes/managment";
import { shopifyWebhook } from "./routes/shopifyWebhook";

export const oracleRoutes = new Elysia({ prefix: "oracle" })
    .use(managmentRoutes)
    .use(shopifyWebhook);
