import { config } from "@api-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const postgresDb = postgres({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    username: config.postgres.user,
    password: config.postgres.password,
});

export const db = drizzle({
    client: postgresDb,
    schema: {
        ...schema,
    },
});
