import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { nexusContext } from "../context";
import {
    interactionSimulationStatus,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "../db/schema";
import { InteractionDiamondRepository } from "./repositories/InteractionDiamondRepository";
import { WalletSessionRepository } from "./repositories/WalletSessionRepository";
/**
 * Context for the interactions service
 * @param app
 */
export const interactionsContext = new Elysia({
    name: "nexus-interactions-context",
})
    .use(nexusContext)
    .decorate(({ client, postgresDb, ...decorators }) => {
        // Build our drizzle DB
        const interactionsDb = drizzle(postgresDb, {
            schema: {
                pendingInteractionsTable,
                interactionSimulationStatus,
                pushedInteractionsTable,
            },
        });

        // Build our interaction diamond repository
        const interactionDiamondRepository = new InteractionDiamondRepository(
            client
        );

        // Build our wallet session repository
        const walletSessionRepository = new WalletSessionRepository(client);

        return {
            ...decorators,
            client,
            interactionsDb,
            interactionDiamondRepository,
            walletSessionRepository,
        };
    })
    .as("plugin");

export type InteractionsContextApp = typeof interactionsContext;

export type InteractionsDb =
    InteractionsContextApp["decorator"]["interactionsDb"];
