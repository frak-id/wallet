import { http, type Chain } from "viem";

/**
 * Type for our alchemy api keys
 */
type AlchemyApiKeys = {
    [chainId: number]: string;
};

/**
 * Get the alchemy http transport
 * @param chainId
 */
export function getAlchemyTransport({ chain }: { chain: Chain }) {
    // Build the alchemy rpc url depending on the chain
    const rpcUrl = getAlchemyRpcUrl({ chain });
    if (!rpcUrl) {
        // Fallback to default transport
        return http();
    }

    // Build the alchemy client
    return http(rpcUrl, {
        batch: {
            wait: 50,
        },
        retryCount: 3,
        retryDelay: 300,
        timeout: 30_000,
    });
}

/**
 * Get the alchemy rpc url for the given chain
 * @param chain
 * @param version
 */
function getAlchemyRpcUrl({ chain }: { chain: Chain }) {
    // Get the network name
    let networkName: string;
    if (chain.id === 421614) {
        networkName = "arb-sepolia";
    } else if (chain.id === 42161) {
        networkName = "arb-mainnet";
    } else {
        return undefined;
    }
    // Extract the api keys and parse them
    const alchemyApiKeys = JSON.parse(
        process.env.ALCHEMY_API_KEYS ?? "{}"
    ) as AlchemyApiKeys;
    const apiKey = alchemyApiKeys[chain.id];
    if (!apiKey) {
        return undefined;
    }

    // Build the alchemy rpc url depending on the chain
    return `https://${networkName}.g.alchemy.com/v2/${apiKey}`;
}
