import postgres from "postgres";

/**
 * One-shot data migration: copies existing Shopify rows from the OLD, publicly
 * accessible Postgres instance into the new in-cluster GCP Postgres.
 *
 * Idempotent + safe to re-run:
 *   - `ON CONFLICT (id) DO NOTHING` means already-copied rows are skipped.
 *   - Skipped entirely when `SHOPIFY_SOURCE_POSTGRES_HOST` is unset, so once the
 *     cutover is done you can drop the source env and this step no-ops forever.
 *
 * Tables copied (see apps/shopify/db/schema):
 *   - `session`  (PK: id text)     — OAuth/session storage
 *   - `purchase` (PK: id serial)   — purchase tracking; sequence is reset after
 */
const BATCH_SIZE = 500;

function buildSourceConfig() {
    const host = process.env.SHOPIFY_SOURCE_POSTGRES_HOST;
    if (!host) return null;
    return {
        host,
        port: Number(process.env.SHOPIFY_SOURCE_POSTGRES_PORT ?? "5432"),
        database: process.env.SHOPIFY_SOURCE_POSTGRES_DB ?? "",
        username: process.env.SHOPIFY_SOURCE_POSTGRES_USER ?? "",
        password: process.env.SHOPIFY_SOURCE_POSTGRES_PASSWORD ?? "",
    };
}

function buildTargetConfig() {
    return {
        host: process.env.POSTGRES_HOST ?? "",
        port: Number(process.env.POSTGRES_PORT ?? "5432"),
        database: process.env.POSTGRES_DB ?? "",
        username: process.env.POSTGRES_USER ?? "",
        password: process.env.POSTGRES_PASSWORD ?? "",
    };
}

async function copyTable(
    source: postgres.Sql,
    target: postgres.Sql,
    table: string
): Promise<number> {
    const rows = await source`SELECT * FROM ${source(table)}`;
    if (rows.length === 0) {
        console.log(
            `[shopify-bootstrap:data] ${table}: source empty, skipping`
        );
        return 0;
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        // postgres.js derives the column list + quoted identifiers from the row
        // keys, which already match the camelCase DB column names.
        const result = await target`
            INSERT INTO ${target(table)} ${target(batch)}
            ON CONFLICT (id) DO NOTHING
        `;
        inserted += result.count;
    }

    console.log(
        `[shopify-bootstrap:data] ${table}: ${inserted}/${rows.length} rows inserted (rest already present)`
    );
    return inserted;
}

/**
 * Reset a serial sequence to MAX(id) so future inserts don't collide with the
 * migrated rows.
 */
async function resetSequence(
    target: postgres.Sql,
    table: string
): Promise<void> {
    await target`
        SELECT setval(
            pg_get_serial_sequence(${table}, 'id'),
            (SELECT COALESCE(MAX(id), 1) FROM ${target(table)})
        )
    `;
}

export async function runDataMigration(): Promise<void> {
    const sourceConfig = buildSourceConfig();
    if (!sourceConfig) {
        console.log(
            "[shopify-bootstrap:data] SHOPIFY_SOURCE_POSTGRES_HOST unset — skipping data migration (post-cutover no-op)"
        );
        return;
    }

    console.log("[shopify-bootstrap:data] Starting data migration");
    const source = postgres({ ...sourceConfig, max: 1 });
    const target = postgres({ ...buildTargetConfig(), max: 1 });

    try {
        await copyTable(source, target, "session");
        const purchaseCount = await copyTable(source, target, "purchase");
        if (purchaseCount > 0) {
            await resetSequence(target, "purchase");
        }
        console.log("[shopify-bootstrap:data] Data migration complete");
    } finally {
        await source.end();
        await target.end();
    }
}
