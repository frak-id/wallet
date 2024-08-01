import { memo } from "radash";
import { type Chain, createClient, fallback } from "viem";
import { getAlchemyTransport } from "./transport/alchemy-transport";
import { getErpcTransport } from "./transport/erpc-transport";

/**
 * Get the transport for the given chain
 */
export const getTransport = memo(
    ({ chain }: { chain: Chain }) => {
        const erpcTransport = getErpcTransport({ chain });
        const alchemyTransport = getAlchemyTransport({ chain });
        return fallback([erpcTransport, alchemyTransport]);
    },
    {
        key: ({ chain }: { chain: Chain }) => `viem-transport-${chain.id}`,
    }
);

/**
 * Get the viem client for the given chain
 */
export const getViemClientFromChain = memo(
    ({ chain }: { chain: Chain }) =>
        createClient({
            chain,
            transport: getTransport({ chain }),
            cacheTime: 60_000,
            batch: {
                multicall: {
                    wait: 50,
                },
            },
        }),
    {
        key: ({ chain }: { chain: Chain }) => `viem-client-${chain.id}`,
    }
);
