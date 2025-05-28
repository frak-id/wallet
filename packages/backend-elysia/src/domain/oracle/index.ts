import { Elysia } from "elysia";
import { customWebhook } from "./routes/webhook/customWebhook";
import { shopifyWebhook } from "./routes/webhook/shopifyWebhook";
import { wooCommerceWebhook } from "./routes/webhook/wooCommerceWebhook";

export const oracle = new Elysia({ prefix: "/oracle" })
    .use(shopifyWebhook)
    .use(wooCommerceWebhook)
    .use(customWebhook);

export { oracleContext, type OracleContextApp } from "./context";
export { productOracleTable, purchaseStatusTable } from "./db/schema";
export { MerkleTreeRepository } from "./repositories/MerkleTreeRepository";
