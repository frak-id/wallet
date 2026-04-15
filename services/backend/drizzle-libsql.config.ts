import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: ["src/domain/auth/db/schema.ts"],
    dialect: "turso",
    dbCredentials: {
        url: process.env.LIBSQL_URL ?? "http://localhost:8080",
    },
    out: "drizzle/libsql",
});
