import { Mutex } from "async-mutex";
import { Elysia } from "elysia";
import { MongoClient } from "mongodb";
import { Config, type SecretTypes } from "sst/node/config";

/**
 * Build the common context for the app
 */
export const mongoDbContext = new Elysia({
    name: "Context.mongoDb",
}).decorate((prev) => {
    // The mutex we will use init new clients (and ensure no duplicates)
    const initMutex = new Mutex();
    // The cached mongo client (from the db key)
    const currentClients = new Map<string, MongoClient>();

    /**
     * Get a mongo db client
     * @param urlKey
     * @param db
     */
    function getMongoDb({ urlKey, db }: { urlKey: string; db: string }) {
        // Check if we have a client already
        const current = currentClients.get(db);
        if (current) {
            return current.db(db);
        }

        // Otherwise, init a new client
        return initMutex.runExclusive(async () => {
            // Check if another thread already init the client (possible if a lot of // executions)
            const current = currentClients.get(db);
            if (current) {
                return current.db(db);
            }

            // Get the mongo client
            const client = new MongoClient(
                Config[urlKey as keyof SecretTypes] as string
            );
            // Store the client
            currentClients.set(db, client);
            await client.connect();
            // And return it
            return client.db(db);
        });
    }

    return {
        ...prev,
        getMongoDb,
    };
});

export type GetMongoDb = typeof mongoDbContext.decorator.getMongoDb;
