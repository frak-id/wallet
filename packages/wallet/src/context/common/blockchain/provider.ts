import {
    getAlchemyTransport,
    getAlchemyTransportNoBatch,
} from "@/context/common/blockchain/alchemy-transport";
import { isRunningInProd } from "@/context/common/env";
import { memo } from "radash";
import { type Chain, createClient, extractChain } from "viem";
import {
    arbitrumSepolia,
    base,
    baseSepolia,
    mainnet,
    optimismSepolia,
    polygon,
} from "viem/chains";

/**
 * All the available chains
 */
export const availableChains = isRunningInProd
    ? ([
          // Mainnet's
          base,
          polygon,
          mainnet,
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
export const getViemClientFromChain = memo(
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
 * Directly expose the arbitrum sepolia viem client, since the paywall part is based on that
 */
export const arbSepoliaPocClient = getViemClientFromChainId({
    chainId: arbitrumSepolia.id,
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
