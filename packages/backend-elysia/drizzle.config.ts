import { isRunningInProd } from "@frak-labs/app-essentials";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: ["src/services/nexus/db/schema.ts"],
    dialect: "postgresql",
    dbCredentials: {
        host:
            process.env.POSTGRES_HOST ??
            process.env.SST_Secret_value_POSTGRES_HOST ??
            "",
        port: 5432,
        database:
            process.env.POSTGRES_DB ??
            process.env.SST_Parameter_value_POSTGRES_DB ??
            "",
        user:
            process.env.POSTGRES_USER ??
            process.env.SST_Parameter_value_POSTGRES_USER ??
            "",
        password:
            process.env.POSTGRES_PASSWORD ??
            process.env.SST_Secret_value_POSTGRES_PASSWORD ??
            "",
    },
    out: isRunningInProd ? "drizzle/prod/" : "drizzle/dev/",
});
