import { type Chain, http } from "viem";

const drpcNetworkName: Record<number, string> = {
    // Testnet's
    421614: "arbitrum-sepolia",
    // Mainnet's
    42161: "arbitrum",
};

/**
 * Get the drpc http transport
 * @param chainId
 */
export function getDrpcTransport({ chain }: { chain: Chain }) {
    // Build the drpc rpc url depending on the chain
    const rpcUrl = getDrpcRpcUrl({ chain });
    if (!rpcUrl) {
        // Fallback to default transport
        return http();
    }

    // Build the drpc client
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
 * Get the drpc rpc url for the given chain
 * @param chain
 * @param version
 */
function getDrpcRpcUrl({ chain, apiKey }: { chain: Chain; apiKey?: string }) {
    // Ensure we got an api key
    const finalApiKey = apiKey ?? process.env.DRPC_API_KEY;
    if (!finalApiKey) {
        return undefined;
    }

    // Ensure we got a network name
    if (!drpcNetworkName[chain.id]) {
        return undefined;
    }

    // Build the drpc rpc url depending on the chain
    return `https://lb.drpc.org/ogrpc?network=${
        drpcNetworkName[chain.id]
    }&dkey=${finalApiKey}`;
}
