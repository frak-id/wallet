import { Elysia } from "elysia";
import postgres from "postgres";
import { Config } from "sst/node/config";

/**
 * Build the common context for the app
 */
export const postgresContext = new Elysia({
    name: "postgres-context",
}).decorate(
    { as: "append" },
    {
        postgresDb: postgres({
            host: Config.POSTGRES_HOST,
            port: 5432,
            database: Config.POSTGRES_DB,
            username: Config.POSTGRES_USER,
            password: Config.POSTGRES_PASSWORD,
        }),
    }
);
