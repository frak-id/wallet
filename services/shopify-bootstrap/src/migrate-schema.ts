import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Resolve the migrations folder the same way apps/shopify/drizzle.config.ts does
 * (STAGE-routed dev/prod histories). The SQL files are copied into the image at
 * ./drizzle/{dev,prod} — see the Dockerfile.
 */
function resolveMigrationFolder(): string {
    const isProd = process.env.STAGE === "production";
    return isProd ? "./drizzle/prod" : "./drizzle/dev";
}

function buildTargetUrl(): string {
    const host = process.env.POSTGRES_HOST ?? "";
    const port = process.env.POSTGRES_PORT ?? "5432";
    const database = process.env.POSTGRES_DB ?? "";
    const user = process.env.POSTGRES_USER ?? "";
    const password = process.env.POSTGRES_PASSWORD ?? "";
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Apply the Shopify Drizzle migrations against the target (GCP) Postgres.
 * Idempotent: drizzle tracks applied migrations in `__drizzle_migrations`.
 */
export async function runSchemaMigrations(): Promise<void> {
    const folder = resolveMigrationFolder();
    console.log(
        `[shopify-bootstrap:schema] Running migrations (stage=${process.env.STAGE}, folder=${folder})`
    );

    const sql = postgres(buildTargetUrl(), { max: 1 });
    const db = drizzle(sql);

    await migrate(db, {
        migrationsFolder: folder,
        migrationsTable: "__drizzle_migrations",
    });
    await sql.end();

    console.log("[shopify-bootstrap:schema] Migrations complete");
}
