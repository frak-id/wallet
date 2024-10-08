import { http, type Chain } from "viem";

/**
 * The alchemy network names, used to rebuild the rpc urls
 * From: https://github.com/alchemyplatform/alchemy-sdk-js/blob/fddd65fff4bd7367469ccb44a0900aa1dcc0cc62/src/types/types.ts#L81
 */
const AlchemyNetworkName: Record<number, string> = {
    // Testnet's
    //80002: "polygon-amoy",
    11155420: "opt-sepolia",
    421614: "arb-sepolia",
    84532: "base-sepolia",
    // Mainnet's
    42161: "arb-mainnet",
    137: "polygon-mainnet",
    8453: "base-mainnet",
    10: "opt-mainnet",
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
 * Get the alchemy http transport
 * @param chainId
 */
export function getAlchemyTransportNoBatch({ chain }: { chain: Chain }) {
    // Build the alchemy rpc url depending on the chain
    const rpcUrl = getAlchemyRpcUrl({ chain });
    if (!rpcUrl) {
        throw new Error(`No alchemy rpc url for chain ${chain.id}`);
    }

    // Build the alchemy client (no batching or anything, isn't supported by alchemy custom endpoints)
    return http(rpcUrl, {
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
    // Ensure we got an api key
    if (!process.env.ALCHEMY_API_KEY) {
        return undefined;
    }

    // Ensure we got a network name
    if (!AlchemyNetworkName[chain.id]) {
        return undefined;
    }

    // Build the alchemy rpc url depending on the chain
    return `https://${
        AlchemyNetworkName[chain.id]
    }.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
}
