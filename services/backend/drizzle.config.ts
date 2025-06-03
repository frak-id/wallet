import { defineConfig } from "drizzle-kit";

const isProd =
    process.env.STAGE === "prod" || process.env.STAGE === "production";

export default defineConfig({
    schema: ["src/domain/*/db/schema.ts"],
    dialect: "postgresql",
    dbCredentials: {
        host: process.env.POSTGRES_HOST ?? "",
        port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432"),
        database: process.env.POSTGRES_DB ?? "",
        user: process.env.POSTGRES_USER ?? "",
        password: process.env.POSTGRES_PASSWORD ?? "",
    },
    out: isProd ? "drizzle/prod/" : "drizzle/dev/",
});
