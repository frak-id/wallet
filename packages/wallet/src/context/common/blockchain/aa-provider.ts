import { memo } from "radash";
import { http, type Chain, createClient } from "viem";

/**
 * Type for our biconomy api keys
 */
type BiconomyPaymasterApiKeys = {
    [chainId: number]: string;
};

export const getBundlerClient = memo(
    (chain: Chain) => {
        // Build the pimlico bundler transport and client
        const url =
            chain.testnet === true
                ? `https://bundler.biconomy.io/api/v2/${chain.id}/${process.env.BICONOMY_API_KEY_DEV}`
                : `https://api.pimlico.io/v1/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;
        const bundlerTransport = http(url);
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

        // Extract the api keys and parse them
        const biconomyApiKeys = JSON.parse(
            process.env.BICONOMY_PAYMASTER_API_KEYS ?? "{}"
        ) as BiconomyPaymasterApiKeys;

        const url = biconomyApiKeys[chain.id]
            ? `https://paymaster.biconomy.io/api/v1/${chain.id}/${
                  biconomyApiKeys[chain.id]
              }`
            : `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;

        // Build the paymaster client
        return createClient({
            chain,
            transport: http(url),
        });
    },
    { key: (chain: Chain) => `paymaster-client-${chain.id}` }
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
