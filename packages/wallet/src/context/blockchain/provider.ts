import { isRunningInProd } from "@/context/common/env";
import { getViemClientFromChain } from "@frak-labs/shared/context/blockchain/provider";
import { getAlchemyTransportNoBatch } from "@frak-labs/shared/context/blockchain/transport/alchemy-transport";
import { createClient } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * The current chain
 */
export const currentChain = isRunningInProd ? arbitrum : arbitrumSepolia;

/**
 * The current client
 */
export const currentViemClient = getViemClientFromChain({
    chain: currentChain,
});

/**
 * Get the alchemy client with no batch on the rpc side
 */
export function getAlchemyClientNoBatch() {
    // Build the alchemy client (no batching or anything, isn't supported by alchemy custom endpoints)
    return createClient({
        currentChain,
        transport: getAlchemyTransportNoBatch({ chain: currentChain }),
        cacheTime: 60_000,
        batch: {
            multicall: { wait: 50 },
        },
    });
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
