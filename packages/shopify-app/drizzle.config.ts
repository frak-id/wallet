import { defineConfig } from "drizzle-kit";

const isProd = process.env.SST_STAGE === "prod";

export default defineConfig({
    schema: ["db/schema/*.ts"],
    dialect: "postgresql",
    dbCredentials: {
        host: process.env.SST_Secret_value_POSTGRES_HOST ?? "",
        port: 5432,
        database: process.env.SST_Parameter_value_POSTGRES_SHOPIFY_DB ?? "",
        user: process.env.SST_Parameter_value_POSTGRES_USER ?? "",
        password: process.env.SST_Secret_value_POSTGRES_PASSWORD ?? "",
    },
    out: isProd ? "drizzle/prod/" : "drizzle/dev/",
});
