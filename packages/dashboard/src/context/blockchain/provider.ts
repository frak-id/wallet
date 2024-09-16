import { isRunningInProd } from "@frak-labs/constant";
import { getViemClientFromChain } from "@frak-labs/constant/blockchain";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * The current blockchain
 */
const currentChain = isRunningInProd ? arbitrum : arbitrumSepolia;

/**
 * Directly expose the frak chain client, since the paywall part is based on that
 */
export const viemClient = getViemClientFromChain({ chain: currentChain });
