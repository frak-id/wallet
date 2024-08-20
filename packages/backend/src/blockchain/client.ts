import { getViemClientFromChain } from "@frak-labs/shared/context/blockchain/provider";
import type { Chain } from "viem";
import { arbitrumSepolia } from "viem/chains";

const chain: Chain = arbitrumSepolia;

export const getViemClient = () => getViemClientFromChain({ chain });
