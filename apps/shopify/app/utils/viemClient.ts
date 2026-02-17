import type { Chain } from "viem";
import { createClient, http } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * Get chain and RPC base URL for a given deployment stage.
 */
export function getChainConfig(stage: string | undefined): {
    chain: Chain;
    baseUrl: string;
} {
    const chain = stage === "production" ? arbitrum : arbitrumSepolia;
    const baseUrl =
        stage === "production"
            ? "https://erpc.gcp.frak.id/nexus-rpc/evm"
            : "https://erpc.gcp-dev.frak.id/nexus-rpc/evm";
    return { chain, baseUrl };
}

/**
 * Build a full RPC URL from base URL, chain ID, and secret.
 */
export function buildRpcUrl(
    baseUrl: string,
    chainId: number,
    rpcSecret: string
): string {
    return `${baseUrl}/${chainId}?token=${rpcSecret}`;
}

const { chain, baseUrl } = getChainConfig(process.env.STAGE);

export const viemClient = createClient({
    transport: http(
        buildRpcUrl(baseUrl, chain.id, process.env.RPC_SECRET ?? ""),
        {
            batch: { wait: 50 },
            retryCount: 1,
            retryDelay: 300,
            timeout: 30_000,
        }
    ),
    chain,
});
