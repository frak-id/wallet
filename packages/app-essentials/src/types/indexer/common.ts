import type { Address } from "viem";

/**
 * A generic token returned by the indexer
 */
export type IndexerToken = {
    address: Address;
    name: string;
    symbol: string;
    decimals: number;
};
