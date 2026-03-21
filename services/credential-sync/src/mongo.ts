import { MongoClient } from "mongodb";
import type { MongoAuthenticator } from "./types";

const MONGODB_URI = process.env.MONGODB_NEXUS_URI;
const MONGODB_DB = "nexus";
const MONGODB_COLLECTION = "authenticators";

function getMongoCollection() {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_NEXUS_URI is required");
    }
    const client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 30_000,
    });
    return {
        collection: client
            .db(MONGODB_DB)
            .collection<MongoAuthenticator>(MONGODB_COLLECTION),
        close: () => client.close(),
    };
}

export async function fetchMongoIds(): Promise<Set<string>> {
    const { collection, close } = getMongoCollection();
    const ids = new Set<string>();
    const cursor = collection
        .find({}, { projection: { _id: 1 } })
        .batchSize(500);
    for await (const doc of cursor) {
        ids.add(doc._id);
    }
    await close();
    return ids;
}

export async function fetchMongoByIds(
    ids: string[]
): Promise<MongoAuthenticator[]> {
    if (ids.length === 0) return [];
    const { collection, close } = getMongoCollection();
    const docs = await collection.find({ _id: { $in: ids } }).toArray();
    await close();
    return docs;
}

export async function insertIntoMongo(
    docs: MongoAuthenticator[]
): Promise<number> {
    if (docs.length === 0) return 0;
    const { collection, close } = getMongoCollection();
    // ordered: false continues on duplicate key errors
    const result = await collection.insertMany(docs, { ordered: false });
    await close();
    return result.insertedCount;
}
