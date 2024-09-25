import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import Elysia from "elysia";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * Build the common context for the app
 */
export const blockchainContext = new Elysia({
    name: "blockchain-context",
}).decorate((decorators) => {
    const chain = isRunningInProd ? arbitrum : arbitrumSepolia;
    const client = getViemClientFromChain({ chain });

    return {
        ...decorators,
        chain,
        client,
    };
});

export type BlockchainContextApp = typeof blockchainContext;
