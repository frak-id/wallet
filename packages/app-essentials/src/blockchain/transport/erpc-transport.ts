import { http, type Chain } from "viem";

/**
 * The default public rpc url
 */
const ERPC_URL = "https://rpc.frak.id/nexus-rpc/evm/";

/**
 * Get the erpc http transport
 * @param chainId
 */
export function getErpcTransport({ chain }: { chain: Chain }) {
    // Ensure we got the nexus api key setuo
    const nexusRpcSecret = process.env.NEXUS_RPC_SECRET;
    if (!nexusRpcSecret) {
        return undefined;
    }

    // Build the ercp rpc url depending on the chain
    const rpcUrl = `${process.env.ERPC_URL ?? ERPC_URL}/${chain.id}?token=${nexusRpcSecret}`;

    // Build the erpc client
    return http(rpcUrl, {
        batch: {
            wait: 50,
        },
        retryCount: 1,
        retryDelay: 300,
        timeout: 30_000,
    });
}
