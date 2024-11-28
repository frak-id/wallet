import {
    AdminWalletsRepository,
    InteractionDiamondRepository,
    PricingRepository,
} from "@backend-common/repositories";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import { Elysia } from "elysia";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * Build the common context for the app
 */
export const blockchainContext = new Elysia({
    name: "Context.blockchain",
}).decorate((decorators) => {
    const chain = isRunningInProd ? arbitrum : arbitrumSepolia;
    const client = getViemClientFromChain({ chain });

    // Some shared repository linked to blockchain
    const adminWalletsRepository = new AdminWalletsRepository();
    const interactionDiamondRepository = new InteractionDiamondRepository(
        client
    );
    const pricingRepository = new PricingRepository();

    return {
        ...decorators,
        chain,
        client,
        adminWalletsRepository,
        interactionDiamondRepository,
        pricingRepository,
    };
});
