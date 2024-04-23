import {
    getBundlerClient,
    getPaymasterClient,
} from "@/context/common/blockchain/aa-provider";
import { useMemo } from "react";
import { useClient } from "wagmi";

/**
 * Fetch the AA clients
 */
export function useAAClients({ chainId }: { chainId?: number } = {}) {
    /**
     * The current viem client
     */
    const viemClient = useClient({ chainId });

    /**
     * Memo building the AA related clients (bundler and paymasters)
     * TODO: Switch to query for caching of this stuff?
     */
    const { bundlerTransport, bundlerClient, paymasterClient } = useMemo(() => {
        if (!viemClient) {
            return {};
        }

        const chain = viemClient.chain;

        // Get the clients
        const { bundlerClient, bundlerTransport } = getBundlerClient(chain);
        const paymasterClient = getPaymasterClient(chain);

        // Return them
        return {
            bundlerTransport,
            bundlerClient,
            paymasterClient,
        };
    }, [viemClient]);

    return useMemo(
        () => ({
            viemClient,
            bundlerTransport,
            bundlerClient,
            paymasterClient,
        }),
        [viemClient, bundlerTransport, bundlerClient, paymasterClient]
    );
}
