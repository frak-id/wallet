import { isRunningInProd } from "@/context/common/env";
import { getViemClientFromChain } from "@frak-labs/shared/context/blockchain/provider";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * The current blockchain
 */
const currentChain = isRunningInProd ? arbitrum : arbitrumSepolia;

/**
 * Directly expose the frak chain client, since the paywall part is based on that
 */
export const viemClient = getViemClientFromChain({ chain: currentChain });
