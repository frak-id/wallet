import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import { isRunningInProd } from "@frak-labs/app-essentials/utils/env";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * The current blockchain
 */
const currentChain = isRunningInProd ? arbitrum : arbitrumSepolia;

/**
 * Directly expose the frak chain client, since the paywall part is based on that
 */
export const viemClient = getViemClientFromChain({ chain: currentChain });
