import type { AvailableChainIds } from "@/context/common/blockchain/provider";
import { http, type Chain } from "viem";

/**
 * Type for our alchemy api keys
 */
type AlchemyApiKeys = {
    [chainId: number]: string;
};

/**
 * The alchemy network names, used to rebuild the rpc urls
 * From: https://github.com/alchemyplatform/alchemy-sdk-js/blob/fddd65fff4bd7367469ccb44a0900aa1dcc0cc62/src/types/types.ts#L81
 */
const AlchemyNetworkName: Record<AvailableChainIds, string> = {
    80001: "polygon-mumbai",
    //80002: "polygon-amoy",
    11155420: "opt-sepolia",
    421614: "arb-sepolia",
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

    // Build the alchemy client (no batching or anything, isn't supported by alchemy custom endpoints)
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
        // Fallback to default transport
        return http();
    }

    // Build the alchemy client (no batching or anything, isn't supported by alchemy custom endpoints)
    return http(rpcUrl, {
        retryCount: 3,
        retryDelay: 300,
        timeout: 30_000,
    });
}

function getAlchemyRpcUrl({ chain }: { chain: Chain }) {
    // Extract the api keys and parse them
    const alchemyApiKeys = JSON.parse(
        process.env.ALCHEMY_API_KEYS ?? "{}"
    ) as AlchemyApiKeys;
    const apiKey = alchemyApiKeys[chain.id];
    if (!apiKey) {
        return undefined;
    }

    // Build the alchemy rpc url depending on the chain
    return `https://${
        AlchemyNetworkName[chain.id as AvailableChainIds]
    }.g.alchemy.com/v2/${apiKey}`;
}