import { Elysia } from "elysia";
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
        // Build our db repositories
        const pendingInteractionsRepository =
            new PendingInteractionsRepository();

        // Build our blockchain repositories
        const interactionPackerRepository = new InteractionPackerRepository();
        const walletSessionRepository = new WalletSessionRepository();
        const interactionSignerRepository = new InteractionSignerRepository();

        // Build our campaign repositories
        const campaignDataRepository = new CampaignDataRepository();
        const campaignRewardsService = new CampaignRewardsService(
            campaignDataRepository
        );

        return {
            ...decorators,
            interactions: {
                repositories: {
                    pendingInteractions: pendingInteractionsRepository,
                    interactionPacker: interactionPackerRepository,
                    walletSession: walletSessionRepository,
                    interactionSigner: interactionSignerRepository,
                    campaignData: campaignDataRepository,
                },
                services: {
                    campaignRewards: campaignRewardsService,
                },
            },
        };
    })
    .as("scoped");

export type InteractionsContextApp = typeof interactionsContext;
