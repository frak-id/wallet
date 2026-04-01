import { Binary } from "mongodb";
import { fetchMongoByIds, fetchMongoIds } from "./mongo";
import { fetchSqldByIds, fetchSqldIds, type SqldRow } from "./sqld";
import type { MongoAuthenticator } from "./types";

function toBase64(value: Binary | Buffer | Uint8Array | string): string {
    if (typeof value === "string") return value;
    if (value instanceof Binary)
        return Buffer.from(value.buffer).toString("base64");
    return Buffer.from(value).toString("base64");
}

function getMismatches(mongo: MongoAuthenticator, sqld: SqldRow): string[] {
    const mismatches: string[] = [];

    if (mongo.publicKey.x !== sqld.publicKeyX)
        mismatches.push(
            `publicKeyX: ${mongo.publicKey.x} ≠ ${sqld.publicKeyX}`
        );
    if (mongo.publicKey.y !== sqld.publicKeyY)
        mismatches.push(
            `publicKeyY: ${mongo.publicKey.y} ≠ ${sqld.publicKeyY}`
        );
    if (toBase64(mongo.credentialPublicKey) !== sqld.credentialPublicKey)
        mismatches.push("credentialPublicKey mismatch");
    if (mongo.credentialDeviceType !== sqld.credentialDeviceType)
        mismatches.push(
            `deviceType: ${mongo.credentialDeviceType} ≠ ${sqld.credentialDeviceType}`
        );
    if (mongo.credentialBackedUp !== sqld.credentialBackedUp)
        mismatches.push(
            `backedUp: ${mongo.credentialBackedUp} ≠ ${sqld.credentialBackedUp}`
        );
    if (mongo.userAgent !== sqld.userAgent)
        mismatches.push("userAgent mismatch");
    if ((mongo.smartWalletAddress ?? null) !== sqld.smartWalletAddress)
        mismatches.push(
            `smartWallet: ${mongo.smartWalletAddress} ≠ ${sqld.smartWalletAddress}`
        );

    return mismatches;
}

function sampleCommonIds(commonIds: string[], sampleSize: number): string[] {
    const sampled: string[] = [];
    const idsCopy = [...commonIds];
    for (let i = 0; i < sampleSize; i++) {
        const idx = Math.floor(Math.random() * idsCopy.length);
        sampled.push(idsCopy.splice(idx, 1)[0]);
    }
    return sampled;
}

async function verify() {
    const [mongoIds, sqldIds] = await Promise.all([
        fetchMongoIds(),
        fetchSqldIds(),
    ]);

    const commonIds = [...mongoIds].filter((id) => sqldIds.has(id));
    if (commonIds.length === 0) {
        console.log("❌ No common IDs found between MongoDB and sqld");
        process.exit(1);
    }

    const sampleSize = Math.min(10, commonIds.length);
    const sampled = sampleCommonIds(commonIds, sampleSize);

    console.log(
        `Verifying ${sampleSize} random credentials out of ${commonIds.length} common entries...\n`
    );

    const [mongoDocs, sqldRows] = await Promise.all([
        fetchMongoByIds(sampled),
        fetchSqldByIds(sampled),
    ]);

    const mongoMap = new Map(mongoDocs.map((d) => [d._id, d]));
    const sqldMap = new Map(sqldRows.map((r) => [r.id, r]));

    let passed = 0;
    let failed = 0;

    for (const id of sampled) {
        const mongo = mongoMap.get(id);
        const sqld = sqldMap.get(id);

        if (!mongo || !sqld) {
            console.log(`❌ ${id} — missing on ${!mongo ? "mongo" : "sqld"}`);
            failed++;
            continue;
        }

        const mismatches = getMismatches(mongo, sqld);

        if (mismatches.length > 0) {
            console.log(`❌ ${id}`);
            for (const m of mismatches) console.log(`   ${m}`);
            failed++;
        } else {
            console.log(`✅ ${id}`);
            passed++;
        }
    }

    console.log(`\n${passed}/${sampleSize} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

verify();
