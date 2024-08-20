import { http, type Chain } from "viem";

/**
 * Get the alchemy http transport
 * @param chainId
 */
export function getErpcTransport({ chain }: { chain: Chain }) {
    // Ensure we got the nexus api key setuo
    const nexusRpcSecret = process.env.NEXUS_RPC_SECRET;
    if (!nexusRpcSecret) {
        return undefined;
    }

    // Build the ercp rpc url depending on the chain
    const rpcUrl = `https://indexer.frak.id/nexus-rpc/evm/${chain.id}?token=${nexusRpcSecret}`;

    // Build the alchemy client
    return http(rpcUrl, {
        batch: {
            wait: 50,
        },
        retryCount: 1,
        retryDelay: 300,
        timeout: 30_000,
    });
}
