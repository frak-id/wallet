import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sessionTable } from "../db/schema/sessionTable";

/**
 * Create our postgres connector
 */
const posgresDb = postgres({
    host: process.env.POSTGRES_HOST,
    port: 5432,
    database: process.env.POSTGRES_SHOPIFY_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});

/**
 * Create our drizzle connector
 */
export const drizzleDb = drizzle(posgresDb, {
    schema: { sessionTable },
});
