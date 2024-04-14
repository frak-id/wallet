import { memo } from "radash";
import { http, type Chain, createClient } from "viem";

export const getBundlerClient = memo(
    (chain: Chain) => {
        // Build the pimlico bundler transport and client
        const bundlerTransport = http(
            `https://api.pimlico.io/v1/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        );
        const bundlerClient = createClient({
            chain,
            transport: bundlerTransport,
        });

        return {
            bundlerTransport,
            bundlerClient,
        };
    },
    { key: (chain: Chain) => `bundler-client-${chain.id}` }
);

export const getPaymasterClient = memo(
    (chain: Chain) => {
        // If the chain isn't a testnet, exit without paymaster as default
        if (chain.testnet !== true) {
            return undefined;
        }

        // Build the paymaster client
        return createClient({
            chain,
            transport: http(
                `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
            ),
        });
    },
    { key: (chain: Chain) => `paymaster-client-${chain.id}` }
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
