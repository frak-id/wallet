import type { Address } from "viem";

/**
 * Token information from the indexer
 */
export type IndexerToken = {
    address: Address;
    name: string;
    symbol: string;
    decimals: number;
};

/**
 * Response type for getting all tokens
 */
export type GetAllTokenResponseDto = IndexerToken[];
