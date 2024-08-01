import { isRunningInProd } from "@/context/common/env";
import { memo } from "radash";
import { type Chain, createClient, extractChain } from "viem";
import {
    arbitrum,
    arbitrumSepolia,
    base,
    baseSepolia,
    optimism,
    optimismSepolia,
    polygon,
} from "viem/chains";
import {
    getAlchemyTransport,
    getAlchemyTransportNoBatch,
} from "./alchemy-transport";

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
 * Get the transport for the given chain
 */
export const getTransport = memo(
    ({ chain }: { chain: Chain }) => getAlchemyTransport({ chain }),
    {
        key: ({ chain }: { chain: Chain }) => `viem-transport-${chain.id}`,
    }
);

/**
 * Get the viem client for the given chain
 */
const getViemClientFromChain = memo(
    ({ chain }: { chain: Chain }) =>
        createClient({
            chain,
            transport: getTransport({ chain }),
            cacheTime: 60_000,
        }),
    {
        key: ({ chain }: { chain: Chain }) => `viem-client-${chain.id}`,
    }
);

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
