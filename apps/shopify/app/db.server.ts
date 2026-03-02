import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
    frakTxStatus,
    purchaseTable,
    shopifyStatus,
} from "../db/schema/purchaseTable";
import { sessionTable } from "../db/schema/sessionTable";

/**
 * Create our postgres connector
 */
const posgresDb = postgres({
    host: process.env.SHOPIFY_POSTGRES_HOST,
    port: 5432,
    database: process.env.POSTGRES_SHOPIFY_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.SHOPIFY_POSTGRES_PASSWORD,
});

/**
 * Create our drizzle connector
 */
export const drizzleDb = drizzle(posgresDb, {
    schema: {
        sessionTable,
        purchaseTable,
        shopifyStatus,
        frakTxStatus,
    },
});
