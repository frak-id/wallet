import { Elysia } from "elysia";
import postgres from "postgres";

/**
 * Build the common context for the app
 */
export const postgresContext = new Elysia({
    name: "Context.postgres",
}).decorate(
    { as: "append" },
    {
        postgresDb: postgres({
            host: process.env.POSTGRES_HOST,
            port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432"),
            database: process.env.POSTGRES_DB,
            username: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
        }),
    }
);
