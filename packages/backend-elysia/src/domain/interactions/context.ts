import {
    adminWalletContext,
    blockchainContext,
    postgresContext,
} from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import {
    interactionSimulationStatus,
    interactionsPurchaseTrackerTable,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "./db/schema";
import { InteractionDiamondRepository } from "./repositories/InteractionDiamondRepository";
import { InteractionSignerRepository } from "./repositories/InteractionSignerRepository";
import { PendingInteractionsRepository } from "./repositories/PendingInteractionsRepository";
import { WalletSessionRepository } from "./repositories/WalletSessionRepository";
/**
 * Context for the interactions service
 * @param app
 */
export const interactionsContext = new Elysia({
    name: "Context.interactions",
})
    .use(blockchainContext)
    .use(postgresContext)
    .use(adminWalletContext)
    .decorate(
        ({ client, postgresDb, adminWalletsRepository, ...decorators }) => {
            // Build our drizzle DB
            const interactionsDb = drizzle(postgresDb, {
                schema: {
                    pendingInteractionsTable,
                    interactionSimulationStatus,
                    pushedInteractionsTable,
                    interactionsPurchaseTrackerTable,
                },
            });

            // Build our db repositories
            const pendingInteractionsRepository =
                new PendingInteractionsRepository(interactionsDb);

            // Build our blockchain repositories
            const interactionDiamondRepository =
                new InteractionDiamondRepository(client);
            const walletSessionRepository = new WalletSessionRepository(client);
            const interactionSignerRepository = new InteractionSignerRepository(
                client,
                adminWalletsRepository
            );

            return {
                ...decorators,
                client,
                interactionsDb,
                // Repos
                pendingInteractionsRepository,
                interactionDiamondRepository,
                walletSessionRepository,
                interactionSignerRepository,
            };
        }
    )
    .as("plugin");

export type InteractionsContextApp = typeof interactionsContext;

export type InteractionsDb = PostgresJsDatabase<{
    pendingInteractionsTable: typeof pendingInteractionsTable;
    interactionSimulationStatus: typeof interactionSimulationStatus;
    pushedInteractionsTable: typeof pushedInteractionsTable;
    interactionsPurchaseTrackerTable: typeof interactionsPurchaseTrackerTable;
}>;
