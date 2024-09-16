import { type Chain, createClient, fallback } from "viem";
import { getAlchemyTransport } from "./transport/alchemy-transport";
import { getErpcTransport } from "./transport/erpc-transport";

/**
 * Get the transport for the given chain
 */
export function getTransport({ chain }: { chain: Chain }) {
    const erpcTransport = getErpcTransport({ chain });
    const alchemyTransport = getAlchemyTransport({ chain });
    if (!erpcTransport) {
        return alchemyTransport;
    }
    return fallback([erpcTransport, alchemyTransport]);
}

/**
 * Get the viem client for the given chain
 */
export function getViemClientFromChain({ chain }: { chain: Chain }) {
    return createClient({
        chain,
        transport: getTransport({ chain }),
        cacheTime: 60_000,
        batch: {
            multicall: {
                wait: 50,
            },
        },
    });
}
