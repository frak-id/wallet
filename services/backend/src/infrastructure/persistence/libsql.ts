import { createClient } from "@libsql/client/http";
import type { LibSQLDatabase } from "drizzle-orm/libsql/driver-core";
import { drizzle } from "drizzle-orm/libsql/http";
import * as authSchema from "../../domain/auth/db/schema";

let cachedDb: LibSQLDatabase<typeof authSchema> | undefined;

/**
 * Get the libsql drizzle database instance, connected to the sqld server over
 * HTTP (no auth token needed, same K8s cluster). Lazy init, cached after.
 */
export function getLibsqlDb(): LibSQLDatabase<typeof authSchema> {
    if (cachedDb) return cachedDb;

    const client = createClient({
        url: process.env.LIBSQL_URL as string,
    });

    cachedDb = drizzle(client, { schema: authSchema });
    return cachedDb;
}
