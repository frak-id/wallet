import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as authSchema from "../../domain/auth/db/schema";

/**
 * Cached libsql drizzle instance
 */
let cachedDb: LibSQLDatabase<typeof authSchema> | undefined;
let cachedClient: Client | undefined;

/**
 * Get the libsql drizzle database instance
 *  - Connects to the sqld server via HTTP
 *  - No auth token required (same K8s cluster)
 *  - Lazy init on first call, cached for subsequent calls
 */
export function getLibsqlDb(): LibSQLDatabase<typeof authSchema> {
    if (cachedDb) return cachedDb;

    const client = createClient({
        url: process.env.LIBSQL_URL as string,
    });
    cachedClient = client;

    cachedDb = drizzle(client, { schema: authSchema });
    return cachedDb;
}

/**
 * Get the raw libsql client (for direct SQL or migration usage)
 */
export function getLibsqlClient(): Client {
    if (cachedClient) return cachedClient;

    const client = createClient({
        url: process.env.LIBSQL_URL as string,
    });
    cachedClient = client;
    return client;
}
