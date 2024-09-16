import { MongoClient } from "mongodb";
import { Config, type SecretTypes } from "sst/node/config";

/**
 * Get a mongo db client
 * @param urlKey
 * @param db
 */
export async function getMongoDb({
    urlKey,
    db,
}: { urlKey: string; db: string }) {
    // Get the mongo client
    const client = new MongoClient(
        Config[urlKey as keyof SecretTypes] as string
    );
    // Connect to the database
    await client.connect();
    // and then connect to the poc database
    return client.db(db);
}
