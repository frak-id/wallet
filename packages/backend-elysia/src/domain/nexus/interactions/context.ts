import { adminWalletContext } from "@backend-common";
import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { nexusContext } from "../context";
import {
    interactionSimulationStatus,
    interactionsPurchaseTrackerTable,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "../db/schema";
import { InteractionDiamondRepository } from "./repositories/InteractionDiamondRepository";
import { InteractionSignerRepository } from "./repositories/InteractionSignerRepository";
import { WalletSessionRepository } from "./repositories/WalletSessionRepository";
/**
 * Context for the interactions service
 * @param app
 */
export const interactionsContext = new Elysia({
    name: "Context.nexus.interactions",
})
    .use(nexusContext)
    .use(adminWalletContext)
    .decorate(
        ({ client, postgresDb, adminWalletsRepository, ...decorators }) => {
            // Build our drizzle DB
            const interactionsDb = drizzle(postgresDb, {
                schema: {
                    pendingInteractionsTable,
                    interactionSimulationStatus,
                    pushedInteractionsTable,
                    interactionsPurchaseMapTable:
                        interactionsPurchaseTrackerTable,
                },
            });

            // Build our repositories
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
                interactionDiamondRepository,
                walletSessionRepository,
                interactionSignerRepository,
            };
        }
    )
    .as("plugin");

export type InteractionsContextApp = typeof interactionsContext;

export type InteractionsDb =
    InteractionsContextApp["decorator"]["interactionsDb"];
