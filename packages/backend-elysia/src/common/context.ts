import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import type { Elysia } from "elysia";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * Build the common context for the app
 * @param app
 */
export function blockchainContext(app: Elysia) {
    const chain = isRunningInProd ? arbitrum : arbitrumSepolia;
    const client = getViemClientFromChain({ chain });

    return app.decorate({
        chain,
        client,
    });
}

export type BlockchainContextApp = ReturnType<typeof blockchainContext>;
