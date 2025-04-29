import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * The current blockchain
 */
const currentChain = isRunningInProd ? arbitrum : arbitrumSepolia;

/**
 * Directly expose the frak chain client, since the paywall part is based on that
 */
export const viemClient = getViemClientFromChain({ chain: currentChain });
