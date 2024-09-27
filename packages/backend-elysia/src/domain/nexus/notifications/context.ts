import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { nexusContext } from "../context";
import { pushTokensTable } from "../db/schema";

export const notificationContext = new Elysia({
    name: "Context.nexus.notification",
})
    .use(nexusContext)
    .decorate(({ postgresDb, ...decorators }) => ({
        ...decorators,
        notificationDb: drizzle(postgresDb, {
            schema: { pushTokensTable },
        }),
    }))
    .as("plugin");
