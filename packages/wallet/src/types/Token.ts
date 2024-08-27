import type { Address } from "viem";

/**
 * Represent a blockchain token
 */
export type Token = {
    address: Address;
    decimal: number;
    name: string;
    symbol: string;
};
