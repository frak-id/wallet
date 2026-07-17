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

function buildTargetConfig() {
    return {
        host: process.env.POSTGRES_HOST ?? "",
        port: Number(process.env.POSTGRES_PORT ?? "5432"),
        database: process.env.POSTGRES_DB ?? "",
        username: process.env.POSTGRES_USER ?? "",
        password: process.env.POSTGRES_PASSWORD ?? "",
    };
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

    const sql = postgres({ ...buildTargetConfig(), max: 1 });
    const db = drizzle(sql);

    await migrate(db, {
        migrationsFolder: folder,
        migrationsTable: "__drizzle_migrations",
    });
    await sql.end();

    console.log("[shopify-bootstrap:schema] Migrations complete");
}
