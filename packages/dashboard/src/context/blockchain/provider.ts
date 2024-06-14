import { getAlchemyTransport } from "@/context/blockchain/alchemy-transport";
import { isRunningInProd } from "@/context/common/env";
import { createClient } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * The current blockchain
 */
export const currentChain = isRunningInProd ? arbitrum : arbitrumSepolia;

/**
 * Directly expose the frak chain client, since the paywall part is based on that
 */
export const viemClient = createClient({
    chain: currentChain,
    transport: getAlchemyTransport({ chain: currentChain }),
    cacheTime: 60_000,
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
