import { getAlchemyTransport } from "@/context/common/blockchain/alchemy-provider";
import { http, createClient, extractChain, fallback } from "viem";
import { arbitrumSepolia, optimismSepolia, polygonMumbai } from "viem/chains";

/**
 * All the available chains
 */
export const availableChains = [
    polygonMumbai,
    arbitrumSepolia,
    optimismSepolia,
] as const;

export type AvailableChainIds = (typeof availableChains)[number]["id"];

/**
 * Build a client from the given chain
 * @param chainId
 */
export function getClientFromChain({ chainId }: { chainId: number }) {
    // Extract the right chain
    const chain = extractChain({
        chains: availableChains,
        id: chainId as AvailableChainIds,
    });
    if (!chain) {
        throw new Error(`Chain with id ${chainId} not found`);
    }

    // TODO: Should create our map of chainId to paid RPC networks and add them as fallback
    // Find the default http transports
    const publicTransportUrls = chain.rpcUrls.default.http;
    if (!publicTransportUrls) {
        throw new Error(
            `Chain with id ${chain.id} does not have a default http transport`
        );
    }

    const publicTransport = http(publicTransportUrls[0], {
        retryCount: 5,
        retryDelay: 200,
        timeout: 20_000,
    });

    const alchemyTransport = getAlchemyTransport({ chain });

    // Build the viem client
    return createClient({
        chain,
        transport: fallback([alchemyTransport, publicTransport]),
        cacheTime: 60_000,
        batch: {
            multicall: { wait: 200 },
        },
    });
}

/**
 * Directly expose the mumbai viem client, since the paywall part is based on that
 */
export const mumbaiPocClient = getClientFromChain({
    chainId: polygonMumbai.id,
});

/**
 * Get the alchemy client
 * @param chainId
 */
export function getAlchemyClient({ chainId }: { chainId: number }) {
    // Extract the right chain
    const chain = extractChain({
        chains: availableChains,
        id: chainId as AvailableChainIds,
    });

    // Get the right transport
    const transport = getAlchemyTransport({ chain });

    // Build the alchemy client (no batching or anything, isn't supported by alchemy custom endpoints)
    return createClient({
        chain,
        transport,
        cacheTime: 60_000,
    });
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
