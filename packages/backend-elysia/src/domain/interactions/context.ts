import { postgresDb } from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import {
    backendTrackerTable,
    interactionSimulationStatus,
    interactionsPurchaseTrackerTable,
    pendingInteractionsTable,
    pushedInteractionsTable,
} from "./db/schema";
import { CampaignDataRepository } from "./repositories/CampaignDataRepository";
import { InteractionPackerRepository } from "./repositories/InteractionPackerRepository";
import { InteractionSignerRepository } from "./repositories/InteractionSignerRepository";
import { PendingInteractionsRepository } from "./repositories/PendingInteractionsRepository";
import { WalletSessionRepository } from "./repositories/WalletSessionRepository";
import { CampaignRewardsService } from "./services/CampaignRewardsService";
/**
 * Context for the interactions service
 * @param app
 */
export const interactionsContext = new Elysia({
    name: "Context.interactions",
})
    .decorate((decorators) => {
        // Build our drizzle DB
        const interactionsDb = drizzle({
            client: postgresDb,
            schema: {
                pendingInteractionsTable,
                interactionSimulationStatus,
                pushedInteractionsTable,
                interactionsPurchaseTrackerTable,
                backendTrackerTable,
            },
        });

        // Build our db repositories
        const pendingInteractionsRepository = new PendingInteractionsRepository(
            interactionsDb
        );

        // Build our blockchain repositories
        const interactionPackerRepository = new InteractionPackerRepository();
        const walletSessionRepository = new WalletSessionRepository();
        const interactionSignerRepository = new InteractionSignerRepository();

        const campaignDataRepository = new CampaignDataRepository();
        const campaignRewardsService = new CampaignRewardsService(
            campaignDataRepository
        );

        return {
            ...decorators,
            interactionsDb,
            // Repos
            pendingInteractionsRepository,
            interactionPackerRepository,
            walletSessionRepository,
            interactionSignerRepository,
            campaignDataRepository,
            campaignRewardsService,
        };
    })
    .as("scoped");

export type InteractionsContextApp = typeof interactionsContext;

export type InteractionsDb = PostgresJsDatabase<{
    pendingInteractionsTable: typeof pendingInteractionsTable;
    interactionSimulationStatus: typeof interactionSimulationStatus;
    pushedInteractionsTable: typeof pushedInteractionsTable;
    interactionsPurchaseTrackerTable: typeof interactionsPurchaseTrackerTable;
    backendTrackerTable: typeof backendTrackerTable;
}>;
