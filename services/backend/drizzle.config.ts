import { defineConfig } from "drizzle-kit";

const schemaName = process.env.POSTGRES_SCHEMA || "public";

function getMigrationConfig(): { out: string; table: string } {
    if (schemaName === "local") {
        return { out: "drizzle/local/", table: "__drizzle_migrations_local" };
    }
    if (schemaName.endsWith("_v2")) {
        return { out: "drizzle/v2/", table: "__drizzle_migrations_v2" };
    }
    const isProd =
        process.env.STAGE === "prod" || process.env.STAGE === "production";
    return {
        out: isProd ? "drizzle/prod/" : "drizzle/dev/",
        table: "__drizzle_migrations",
    };
}

const migrationConfig = getMigrationConfig();

export default defineConfig({
    schema: ["src/domain/*/db/schema.ts"],
    dialect: "postgresql",
    dbCredentials: {
        host: process.env.POSTGRES_HOST ?? "",
        port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
        database: process.env.POSTGRES_DB ?? "",
        user: process.env.POSTGRES_USER ?? "",
        password: process.env.POSTGRES_PASSWORD ?? "",
    },
    migrations: {
        table: migrationConfig.table,
    },
    schemaFilter: [schemaName],
    out: migrationConfig.out,
});
