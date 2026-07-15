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
    // Small shared pool per Lambda instance. Keeps us well under the DB's tight
    // max_connections (50) ceiling. The real fan-out guard is the reserved
    // concurrency on the server function (see infra/shopify.ts).
    max: 2,
    // Release the connection during idle periods so frozen/idle Lambdas don't
    // hold slots (seconds).
    idle_timeout: 20,
    // Fail fast instead of piling up when the DB is saturated (seconds).
    connect_timeout: 10,
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
