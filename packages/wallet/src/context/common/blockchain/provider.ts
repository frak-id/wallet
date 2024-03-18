import { http, createClient } from "viem";
import {polygonAmoy, polygonMumbai} from "viem/chains";

export const rpcTransport = http(process.env.RPC_URL, {
    batch: { wait: 50 },
    retryCount: 5,
    retryDelay: 200,
    timeout: 20_000,
});

// Build the viem client
export const viemClient = createClient({
    chain: polygonAmoy,
    transport: rpcTransport,
    cacheTime: 60_000,
    batch: {
        multicall: { wait: 50 },
    },
});

// Build the alchemy client (same as the viem one but batch cache)
export const alchemyClient = createClient({
    chain: polygonAmoy,
    transport: http(process.env.RPC_URL),
    cacheTime: 60_000,
});

export const pimlicoTransport = http(
    `https://api.pimlico.io/v2/80002/rpc?apikey=${process.env.PIMLICO_API_KEY}`
);
// Build the pimlico bundler client
export const pimlicoBundlerClient = createClient({
    chain: polygonAmoy,
    transport: pimlicoTransport,
});

// Build the pimlico paymaster client
export const pimlicoPaymasterClient = createClient({
    chain: polygonAmoy,
    transport: pimlicoTransport,
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
