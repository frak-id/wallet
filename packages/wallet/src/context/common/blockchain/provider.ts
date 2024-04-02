import {
    getAlchemyTransport,
    getAlchemyTransportNoBatch,
} from "@/context/common/blockchain/alchemy-transport";
import { type HttpTransport, createClient, extractChain } from "viem";
import { arbitrumSepolia, optimismSepolia, polygonMumbai } from "viem/chains";

/**
 * All the available chains
 */
export const availableChains = [
    arbitrumSepolia,
    optimismSepolia,
    polygonMumbai,
] as const;

export type AvailableChainIds = (typeof availableChains)[number]["id"];

/**
 * Create alchemy transports for all the available chains
 * TODO: Probably a bit mem consuming, should be lazy loaded
 */
export const availableTransports = Object.fromEntries(
    availableChains.map((chain) => [chain.id, getAlchemyTransport({ chain })])
) as Record<AvailableChainIds, HttpTransport>;

/**
 * Create each viem client for all the available chains
 * TODO: Same should be lazy loaded
 */
export const availableClients = Object.fromEntries(
    availableChains.map((chain) => [
        chain.id,
        createClient({
            chain,
            transport: availableTransports[chain.id],
            cacheTime: 60_000,
        }),
    ])
);

/**
 * Directly expose the mumbai viem client, since the paywall part is based on that
 */
export const arbSepoliaPocClient = availableClients[arbitrumSepolia.id];

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
