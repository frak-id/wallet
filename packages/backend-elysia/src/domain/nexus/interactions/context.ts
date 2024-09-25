import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { nexusContext } from "../context";
import {
    interactionSimulationStatus,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "../db/schema";
/**
 * Context for the interactions service
 * @param app
 */
export const interactionsContext = new Elysia({
    name: "nexus-interactions-context",
})
    .use(nexusContext)
    .decorate(({ postgresDb, ...decorators }) => ({
        ...decorators,
        interactionsDb: drizzle(postgresDb, {
            schema: {
                pendingInteractionsTable,
                interactionSimulationStatus,
                pushedInteractionsTable,
            },
        }),
    }))
    .as("plugin");

export type InteractionsContextApp = typeof interactionsContext;
