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
    port: process.env.SHOPIFY_POSTGRES_PORT
        ? Number(process.env.SHOPIFY_POSTGRES_PORT)
        : 5432,
    database: process.env.POSTGRES_SHOPIFY_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.SHOPIFY_POSTGRES_PASSWORD,
    // Long-lived per-pod pool — we run on k8s now, not Lambda. The deployment
    // is HPA-capped at 3 replicas (prod), so worst case ~60 connections, well
    // under the DB's max_connections ceiling.
    max: 20,
    // Release idle connections so scaled-down/idle pods don't hold slots (seconds).
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
