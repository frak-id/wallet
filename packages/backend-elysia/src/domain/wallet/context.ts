import { blockchainContext, indexerApiContext } from "@backend-common";
import { Elysia } from "elysia";
import { BalancesRepository } from "./repositories/BalancesRepository";
import { CampaignDataRepository } from "./repositories/CampaignDataRepository";
import { PricingRepository } from "./repositories/PricingRepository";
import { CampaignRewardsService } from "./services/CampaignRewardsService";

/**
 * Context for the wallet service
 */
export const walletContext = new Elysia({
    name: "Context.wallet",
})
    .use(indexerApiContext)
    .use(blockchainContext)
    .decorate(({ client, indexerApi, ...decorators }) => {
        const balancesRepository = new BalancesRepository(client);
        const pricingRepository = new PricingRepository();
        const campaignDataRepository = new CampaignDataRepository(client);
        const campaignRewardsService = new CampaignRewardsService(
            client,
            indexerApi,
            pricingRepository,
            campaignDataRepository
        );
        return {
            ...decorators,
            indexerApi,
            client,
            pricingRepository,
            balancesRepository,
            campaignDataRepository,
            campaignRewardsService,
        };
    });
