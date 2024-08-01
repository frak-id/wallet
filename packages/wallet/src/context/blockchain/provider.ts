import { isRunningInProd } from "@/context/common/env";
import { getViemClientFromChain } from "@frak-labs/shared/context/blockchain/provider";
import { getAlchemyTransportNoBatch } from "@frak-labs/shared/context/blockchain/transport/alchemy-transport";
import { createClient, extractChain } from "viem";
import {
    arbitrum,
    arbitrumSepolia,
    base,
    baseSepolia,
    optimism,
    optimismSepolia,
    polygon,
} from "viem/chains";

/**
 * All the available chains
 */
export const availableChains = isRunningInProd
    ? ([
          // Mainnet's
          arbitrum,
          base,
          optimism,
          polygon,
      ] as const)
    : ([
          // Testnet's
          arbitrumSepolia,
          optimismSepolia,
          baseSepolia,
      ] as const);

export type AvailableChainIds = (typeof availableChains)[number]["id"];

/**
 * Get a viem client for the chain id
 * @param chainId
 */
export function getViemClientFromChainId({ chainId }: { chainId: number }) {
    // Get the matching chain
    const chain = availableChains.find(({ id }) => id === chainId);
    if (!chain) {
        throw new Error(`Chain with id ${chainId} not configured`);
    }
    // And return the viem client
    return getViemClientFromChain({ chain });
}

/**
 * The chain id for the frak related apps
 */
export const frakChainId = isRunningInProd ? arbitrum.id : arbitrumSepolia.id;

/**
 * Directly expose the frak chain client, since the paywall part is based on that
 */
export const frakChainPocClient = getViemClientFromChainId({
    chainId: frakChainId,
});

/**
 * Get the alchemy client with no batch on the rpc side
 * @param chainId
 */
export function getAlchemyClientNoBatch({ chainId }: { chainId: number }) {
    // Extract the right chain
    const chain = extractChain({
        chains: availableChains,
        id: chainId as AvailableChainIds,
    });

    // Build the alchemy client (no batching or anything, isn't supported by alchemy custom endpoints)
    return createClient({
        chain,
        transport: getAlchemyTransportNoBatch({ chain }),
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
