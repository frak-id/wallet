import { Mutex } from "async-mutex";
import { MongoClient } from "mongodb";
import postgres from "postgres";

/**
 * Postgres master client
 */
export const postgresDb = postgres({
    host: process.env.POSTGRES_HOST,
    port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432"),
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
});

// The mutex we will use init new clients (and ensure no duplicates)
const monoInitMutex = new Mutex();
// The cached mongo client (from the db key)
const currentMongoClients = new Map<string, MongoClient>();
/**
 * Get a mongo db client
 * @param urlKey
 * @param db
 */
export function getMongoDb({ urlKey, db }: { urlKey: string; db: string }) {
    // Check if we have a client already
    const current = currentMongoClients.get(db);
    if (current) {
        return current.db(db);
    }

    // Otherwise, init a new client
    return monoInitMutex.runExclusive(async () => {
        // Check if another thread already init the client (possible if a lot of // executions)
        const current = currentMongoClients.get(db);
        if (current) {
            return current.db(db);
        }

        // Get the mongo client
        const client = new MongoClient(process.env[urlKey] as string);
        // Store the client
        currentMongoClients.set(db, client);
        await client.connect();
        // And return it
        return client.db(db);
    });
}

export type GetMongoDb = typeof getMongoDb;
