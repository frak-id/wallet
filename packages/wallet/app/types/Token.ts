import type { Address, Hex } from "viem";

/**
 * Represent a blockchain token
 */
export type Token = {
    address: Address;
    decimal: number;
    name: string;
    symbol: string;
};

export type BalanceItem = {
    token: Address;
    name: string;
    symbol: string;
    decimals: number;
    balance: number;
    eurBalance: number;
    rawBalance: Hex;
};
