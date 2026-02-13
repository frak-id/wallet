import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import type {
    OldProductOracle,
    OldPurchase,
    OldPurchaseItem,
    OldPurchaseTracker,
    OracleSnapshot,
} from "./types";

const stage = process.env.STAGE ?? "dev";

function getPostgresClient() {
    return postgres({
        host: process.env.POSTGRES_HOST,
        port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
        database: process.env.POSTGRES_DB,
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        connection: {
            search_path: process.env.POSTGRES_SCHEMA || "public",
        },
    });
}

function byteaToHex(value: Buffer | Uint8Array | null): string | null {
    if (!value) return null;
    return `0x${Buffer.from(value).toString("hex")}`;
}

function mapOracle(row: Record<string, unknown>): OldProductOracle {
    return {
        id: row.id as number,
        product_id: byteaToHex(row.product_id as Buffer) ?? "",
        hook_signature_key: row.hook_signature_key as string,
        created_at: row.created_at
            ? (row.created_at as Date).toISOString()
            : null,
        platform: row.platform as OldProductOracle["platform"],
        merkle_root: byteaToHex(row.merkle_root as Buffer | null),
        synced: row.synced as boolean | null,
        last_sync_tx_hash: byteaToHex(row.last_sync_tx_hash as Buffer | null),
    };
}

function mapPurchase(row: Record<string, unknown>): OldPurchase {
    return {
        id: row.id as number,
        oracle_id: row.oracle_id as number,
        purchase_id: byteaToHex(row.purchase_id as Buffer) ?? "",
        external_id: row.external_id as string,
        external_customer_id: row.external_customer_id as string,
        purchase_token: row.purchase_token as string | null,
        total_price: String(row.total_price),
        currency_code: row.currency_code as string,
        status: row.status as OldPurchase["status"],
        leaf: byteaToHex(row.leaf as Buffer | null),
        created_at: row.created_at
            ? (row.created_at as Date).toISOString()
            : null,
        updated_at: row.updated_at
            ? (row.updated_at as Date).toISOString()
            : null,
    };
}

function mapPurchaseItem(row: Record<string, unknown>): OldPurchaseItem {
    return {
        id: row.id as number,
        purchase_id: byteaToHex(row.purchase_id as Buffer) ?? "",
        external_id: row.external_id as string,
        price: String(row.price),
        name: row.name as string,
        title: row.title as string,
        image_url: row.image_url as string | null,
        quantity: row.quantity as number,
        created_at: row.created_at
            ? (row.created_at as Date).toISOString()
            : null,
    };
}

function mapTracker(row: Record<string, unknown>): OldPurchaseTracker {
    return {
        id: row.id as number,
        wallet: byteaToHex(row.wallet as Buffer) ?? "",
        external_purchase_id: row.external_purchase_id as string,
        external_customer_id: row.external_customer_id as string,
        token: row.token as string,
        pushed: row.pushed as boolean | null,
        created_at: row.created_at
            ? (row.created_at as Date).toISOString()
            : null,
    };
}

export async function extractSnapshot(): Promise<void> {
    const sql = getPostgresClient();

    try {
        console.log(`[snapshot] Connecting to database (stage: ${stage})...`);

        const [oracleRows, purchaseRows, itemRows, allTrackerRows] =
            await Promise.all([
                sql`SELECT * FROM product_oracle ORDER BY id`,
                sql`SELECT * FROM product_oracle_purchase ORDER BY id`,
                sql`SELECT * FROM product_oracle_purchase_item ORDER BY id`,
                sql`SELECT * FROM interactions_purchase_tracker ORDER BY id`,
            ]);

        console.log(
            `[snapshot] Fetched: ${oracleRows.length} oracles, ${purchaseRows.length} purchases, ${itemRows.length} items, ${allTrackerRows.length} trackers`
        );

        const unpushedTrackers = allTrackerRows.filter(
            (r) => r.pushed !== true
        );
        const skippedPushed = allTrackerRows.length - unpushedTrackers.length;

        console.log(
            `[snapshot] Trackers: keeping ${unpushedTrackers.length} unpushed, skipping ${skippedPushed} already pushed`
        );

        const snapshot: OracleSnapshot = {
            snapshotVersion: 1,
            createdAt: new Date().toISOString(),
            stage,
            tables: {
                productOracles: oracleRows.map((r) =>
                    mapOracle(r as Record<string, unknown>)
                ),
                purchases: purchaseRows.map((r) =>
                    mapPurchase(r as Record<string, unknown>)
                ),
                purchaseItems: itemRows.map((r) =>
                    mapPurchaseItem(r as Record<string, unknown>)
                ),
                purchaseTrackers: unpushedTrackers.map((r) =>
                    mapTracker(r as Record<string, unknown>)
                ),
            },
            counts: {
                productOracles: oracleRows.length,
                purchases: purchaseRows.length,
                purchaseItems: itemRows.length,
                purchaseTrackers: unpushedTrackers.length,
                purchaseTrackersSkippedPushed: skippedPushed,
            },
        };

        const snapshotsDir = join(import.meta.dir, "..", "..", "snapshots");
        mkdirSync(snapshotsDir, { recursive: true });

        const filename = `oracle-snapshot-${stage}-${Date.now()}.json`;
        const filepath = join(snapshotsDir, filename);

        writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
        console.log(`[snapshot] Written to ${filepath}`);

        const latestPath = join(
            snapshotsDir,
            `oracle-snapshot-${stage}-latest.json`
        );
        writeFileSync(latestPath, JSON.stringify(snapshot, null, 2));
        console.log(`[snapshot] Latest copy at ${latestPath}`);

        printSnapshotSummary(snapshot);
    } catch (error) {
        console.error("[snapshot] Error during extraction:", error);
        throw error;
    } finally {
        await sql.end();
    }
}

function printSnapshotSummary(snapshot: OracleSnapshot): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log("SNAPSHOT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Stage: ${snapshot.stage}`);
    console.log(`Created: ${snapshot.createdAt}`);
    console.log(`Product Oracles: ${snapshot.counts.productOracles}`);
    console.log(`Purchases: ${snapshot.counts.purchases}`);
    console.log(`Purchase Items: ${snapshot.counts.purchaseItems}`);
    console.log(
        `Purchase Trackers (unpushed): ${snapshot.counts.purchaseTrackers}`
    );
    console.log(
        `Purchase Trackers (skipped/pushed): ${snapshot.counts.purchaseTrackersSkippedPushed}`
    );
    console.log(`${"=".repeat(60)}\n`);
}

if (import.meta.main) {
    extractSnapshot()
        .then(() => {
            console.log("[snapshot] Done");
            process.exit(0);
        })
        .catch((error) => {
            console.error("[snapshot] Failed:", error);
            process.exit(1);
        });
}
