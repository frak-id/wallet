import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import { arbitrum, arbitrumSepolia } from "viem/chains";

const chain = isRunningInProd ? arbitrum : arbitrumSepolia;
export const viemClient = getViemClientFromChain({ chain });
