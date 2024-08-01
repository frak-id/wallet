import { http, type Chain } from "viem";

/**
 * Get the alchemy http transport
 * @param chainId
 */
export function getErpcTransport({ chain }: { chain: Chain }) {
    // Build the ercp rpc url depending on the chain
    const rpcUrl = `https://indexer.frak.id/rpc-main/evm/${chain.id}`;

    // Build the alchemy client
    return http(rpcUrl, {
        // todo: batch disabled for now: https://github.com/erpc/erpc/issues/17
        batch: false,
        retryCount: 3,
        retryDelay: 300,
        timeout: 30_000,
    });
}
