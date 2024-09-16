import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import type { Chain } from "viem";
import { arbitrumSepolia } from "viem/chains";

const chain: Chain = arbitrumSepolia;

export const getViemClient = () => getViemClientFromChain({ chain });
