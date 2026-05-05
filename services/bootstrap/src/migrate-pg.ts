import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Resolve the migrations folder + tracking table the same way drizzle.config.ts does.
 * Keep this in sync with services/bootstrap/drizzle.config.ts.
 */
function resolveMigrationConfig(schemaName: string): {
    folder: string;
    table: string;
} {
    if (schemaName === "local") {
        return {
            folder: "./drizzle/local",
            table: "__drizzle_migrations_local",
        };
    }
    if (schemaName.endsWith("_v2")) {
        return { folder: "./drizzle/v2", table: "__drizzle_migrations_v2" };
    }
    const isProd =
        process.env.STAGE === "prod" || process.env.STAGE === "production";
    return {
        folder: isProd ? "./drizzle/prod" : "./drizzle/dev",
        table: "__drizzle_migrations",
    };
}

function buildDatabaseUrl(schemaName: string): string {
    const host = process.env.POSTGRES_HOST ?? "";
    const port = process.env.POSTGRES_PORT ?? "5432";
    const database = process.env.POSTGRES_DB ?? "";
    const user = process.env.POSTGRES_USER ?? "";
    const password = process.env.POSTGRES_PASSWORD ?? "";
    return `postgresql://${user}:${password}@${host}:${port}/${database}?search_path=${schemaName}`;
}

export async function runPgMigrations(): Promise<void> {
    const schemaName = process.env.POSTGRES_SCHEMA || "public";
    const { folder, table } = resolveMigrationConfig(schemaName);

    console.log(
        `[bootstrap:pg] Running Postgres migrations (schema=${schemaName}, folder=${folder})`
    );

    const sql = postgres(buildDatabaseUrl(schemaName), { max: 1 });
    const db = drizzle(sql);

    await migrate(db, { migrationsFolder: folder, migrationsTable: table });
    await sql.end();

    console.log("[bootstrap:pg] Postgres migrations complete");
}
