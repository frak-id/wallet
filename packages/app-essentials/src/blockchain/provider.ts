import { type Chain, createClient, fallback } from "viem";
import { getAlchemyTransport } from "./transport/alchemy-transport";
import { getErpcTransport } from "./transport/erpc-transport";

/**
 * Get the transport for the given chain
 */
export function getTransport<TChain extends Chain>({
    chain,
}: { chain: TChain }) {
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
export function getViemClientFromChain<TChain extends Chain>({
    chain,
}: { chain: TChain }) {
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
