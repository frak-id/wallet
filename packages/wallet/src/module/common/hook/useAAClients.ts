import { useMemo } from "react";
import { http, createClient } from "viem";
import { useClient } from "wagmi";

/**
 * Fetch the AA clients
 */
export function useAAClients() {
    /**
     * The current viem client
     */
    const viemClient = useClient();

    /**
     * Memo building the AA related clients (bundler and paymasters)
     * TODO: Switch to query for caching of this stuff?
     */
    const { bundlerTransport, bundlerClient, paymasterClient } = useMemo(() => {
        if (!viemClient) {
            return {};
        }

        const chain = viemClient.chain;

        // Build the pimlico bundler transport and client
        const bundlerTransport = http(
            `https://api.pimlico.io/v1/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
        );
        const bundlerClient = createClient({
            chain,
            transport: bundlerTransport,
        });

        // If the chain isn't a testnet, exit without paymaster as default
        if (chain.testnet !== true) {
            return {
                bundlerTransport,
                bundlerClient,
            };
        }

        // Build the pimlico paymaster client
        const paymasterClient = createClient({
            chain,
            transport: http(
                `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
            ),
        });

        return {
            bundlerTransport,
            bundlerClient,
            paymasterClient,
        };
    }, [viemClient]);

    return useMemo(
        () => ({
            bundlerTransport,
            bundlerClient,
            paymasterClient,
        }),
        [bundlerTransport, bundlerClient, paymasterClient]
    );
}
