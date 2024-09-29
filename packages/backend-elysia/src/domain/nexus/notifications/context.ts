import { postgresContext } from "@backend-common";
import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { pushTokensTable } from "../db/schema";

export const notificationContext = new Elysia({
    name: "Context.nexus.notification",
})
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => ({
        ...decorators,
        notificationDb: drizzle(postgresDb, {
            schema: { pushTokensTable },
        }),
    }))
    .as("plugin");
