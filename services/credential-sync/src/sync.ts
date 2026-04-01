import { Binary } from "mongodb";
import { fetchMongoByIds, fetchMongoIds, insertIntoMongo } from "./mongo";
import {
    fetchSqldByIds,
    fetchSqldIds,
    insertIntoSqld,
    type SqldRow,
} from "./sqld";
import type { MongoAuthenticator } from "./types";

const BATCH_SIZE = 100;

function toBase64(value: Binary | Buffer | Uint8Array | string): string {
    if (typeof value === "string") return value;
    if (value instanceof Binary)
        return Buffer.from(value.buffer).toString("base64");
    return Buffer.from(value).toString("base64");
}

function mongoToSqld(doc: MongoAuthenticator): SqldRow {
    return {
        id: doc._id,
        smartWalletAddress: doc.smartWalletAddress ?? null,
        userAgent: doc.userAgent,
        publicKeyX: doc.publicKey.x,
        publicKeyY: doc.publicKey.y,
        credentialPublicKey: toBase64(doc.credentialPublicKey),
        counter: doc.counter,
        credentialDeviceType: doc.credentialDeviceType,
        credentialBackedUp: doc.credentialBackedUp,
        transports: doc.transports ?? null,
    };
}

function sqldToMongo(row: SqldRow): MongoAuthenticator {
    return {
        _id: row.id,
        smartWalletAddress: row.smartWalletAddress ?? undefined,
        userAgent: row.userAgent,
        publicKey: {
            x: row.publicKeyX,
            y: row.publicKeyY,
        },
        credentialPublicKey: new Binary(
            Buffer.from(row.credentialPublicKey, "base64")
        ),
        counter: row.counter,
        credentialDeviceType: row.credentialDeviceType,
        credentialBackedUp: row.credentialBackedUp,
        transports: row.transports ?? undefined,
    };
}

function chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

async function syncMongoToSqld(
    mongoIds: Set<string>,
    sqldIds: Set<string>
): Promise<number> {
    const missingInSqld = [...mongoIds].filter((id) => !sqldIds.has(id));
    if (missingInSqld.length === 0) return 0;

    console.log(`[mongo→sqld] ${missingInSqld.length} credentials to sync`);

    let inserted = 0;
    for (const batch of chunk(missingInSqld, BATCH_SIZE)) {
        const docs = await fetchMongoByIds(batch);
        const rows = docs.map(mongoToSqld);
        inserted += await insertIntoSqld(rows);
    }
    return inserted;
}

async function syncSqldToMongo(
    mongoIds: Set<string>,
    sqldIds: Set<string>
): Promise<number> {
    const missingInMongo = [...sqldIds].filter((id) => !mongoIds.has(id));
    if (missingInMongo.length === 0) return 0;

    console.log(`[sqld→mongo] ${missingInMongo.length} credentials to sync`);

    let inserted = 0;
    for (const batch of chunk(missingInMongo, BATCH_SIZE)) {
        const rows = await fetchSqldByIds(batch);
        const docs = rows.map(sqldToMongo);
        inserted += await insertIntoMongo(docs);
    }
    return inserted;
}

export async function runBidirectionalSync(): Promise<{
    mongoToSqld: number;
    sqldToMongo: number;
}> {
    const [mongoIds, sqldIds] = await Promise.all([
        fetchMongoIds(),
        fetchSqldIds(),
    ]);

    console.log(
        `[credential-sync] Found ${mongoIds.size} in MongoDB, ${sqldIds.size} in sqld`
    );

    const toSqld = await syncMongoToSqld(mongoIds, sqldIds);
    const toMongo = await syncSqldToMongo(mongoIds, sqldIds);

    return { mongoToSqld: toSqld, sqldToMongo: toMongo };
}
