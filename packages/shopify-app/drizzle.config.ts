import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

const isProd = process.env.STAGE === "prod";

export default defineConfig({
    schema: ["db/schema/*.ts"],
    dialect: "postgresql",
    dbCredentials: {
        host: Resource.POSTGRES_HOST.value ?? "",
        port: 5432,
        database: process.env.POSTGRES_SHOPIFY_DB ?? "",
        user: process.env.POSTGRES_USER ?? "",
        password: Resource.POSTGRES_PASSWORD.value ?? "",
    },
    out: isProd ? "drizzle/prod/" : "drizzle/dev/",
});
