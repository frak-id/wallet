import { http, type Chain, createClient } from "viem";
import { polygonMumbai } from "viem/chains";

const rpcTransport = http(process.env.RPC_URL, {
    batch: { wait: 50 },
    retryCount: 5,
    retryDelay: 200,
    timeout: 20_000,
});

// Build the viem client
export const viemClient = createClient({
    chain: polygonMumbai,
    transport: rpcTransport,
    cacheTime: 60_000,
    batch: {
        multicall: { wait: 50 },
    },
});

// Build the alchemy client (same as the viem one but batch cache)
export const alchemyClient = createClient({
    chain: polygonMumbai,
    transport: http(process.env.RPC_URL),
    cacheTime: 60_000,
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
