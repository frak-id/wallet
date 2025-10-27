import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
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
