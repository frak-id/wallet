import { http, createClient, extractChain } from "viem";
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
    const httpTransports = chain.rpcUrls.default.http;
    if (!httpTransports) {
        throw new Error(
            `Chain with id ${chain.id} does not have a default http transport`
        );
    }

    // Build the viem client
    return createClient({
        chain,
        transport: http(httpTransports[0], {
            retryCount: 5,
            retryDelay: 200,
            timeout: 20_000,
        }),
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
 * Type for our alchemy api keys
 */
export type AlchemyApiKeys = {
    [chainId: number]: string;
};

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
    if (!chain) {
        throw new Error(`Chain with id ${chainId} not found`);
    }

    // Extract the api keys and parse them
    const alchemyApiKeys = JSON.parse(
        process.env.ALCHEMY_API_KEYS ?? ""
    ) as AlchemyApiKeys;
    const apiKey = alchemyApiKeys[chainId];
    if (!apiKey) {
        throw new Error(`No alchemy api key found for chain ${chainId}`);
    }

    // Build the alchemy rpc url depending on the chain
    const rpcUrl = `https://${
        AlchemyNetworkName[chain.id]
    }.g.alchemy.com/v2/${apiKey}`;

    // Build the alchemy client (no batching or anything, isn't supported by alchemy custom endpoints)
    return createClient({
        chain,
        transport: http(rpcUrl),
        cacheTime: 60_000,
    });
}

/**
 * The alchemy network names, used to rebuild the rpc urls
 * From: https://github.com/alchemyplatform/alchemy-sdk-js/blob/fddd65fff4bd7367469ccb44a0900aa1dcc0cc62/src/types/types.ts#L81
 */
export const AlchemyNetworkName: Record<AvailableChainIds, string> = {
    80001: "polygon-mumbai",
    //80002: "polygon-amoy",
    11155420: "opt-sepolia",
    421614: "arb-sepolia",
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
