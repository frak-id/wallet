import { defineConfig } from "drizzle-kit";

const isProd = process.env.STAGE === "prod";

export default defineConfig({
    schema: ["db/schema/*.ts"],
    dialect: "postgresql",
    dbCredentials: {
        host: process.env.POSTGRES_HOST ?? "",
        port: 5432,
        database: process.env.POSTGRES_SHOPIFY_DB ?? "",
        user: process.env.POSTGRES_USER ?? "",
        password: process.env.POSTGRES_PASSWORD ?? "",
    },
    out: isProd ? "drizzle/prod/" : "drizzle/dev/",
});
