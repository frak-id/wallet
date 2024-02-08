import { bundlerActions } from "permissionless";
import {
    pimlicoBundlerActions,
    pimlicoPaymasterActions,
} from "permissionless/actions/pimlico";
import { http, createPublicClient } from "viem";
import { polygonMumbai } from "viem/chains";

export const rpcTransport = http(process.env.RPC_URL, {
    batch: { wait: 50 },
    retryCount: 5,
    retryDelay: 200,
    timeout: 20_000,
});

// Build the viem client
export const viemClient = createPublicClient({
    chain: polygonMumbai,
    transport: rpcTransport,
    cacheTime: 60_000,
    batch: {
        multicall: { wait: 50 },
    },
});

export const pimlicoBundlerTransport = http(
    `https://api.pimlico.io/v1/mumbai/rpc?apikey=${process.env.PIMLICO_API_KEY}`
);
// Build the pimlico bundler client
export const pimlicoBundlerClient = createPublicClient({
    chain: polygonMumbai,
    transport: pimlicoBundlerTransport,
})
    .extend(bundlerActions)
    .extend(pimlicoBundlerActions);

// Build the pimlico paymaster client
export const pimlicoPaymasterClient = createPublicClient({
    chain: polygonMumbai,
    transport: http(
        `https://api.pimlico.io/v2/mumbai/rpc?apikey=${process.env.PIMLICO_API_KEY}`
    ),
})
    .extend(pimlicoBundlerActions)
    .extend(pimlicoPaymasterActions);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
