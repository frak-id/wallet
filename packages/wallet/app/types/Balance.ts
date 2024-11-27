import type { Address, Hex } from "viem";

export type BalanceItem = {
    token: Address;
    name: string;
    symbol: string;
    decimals: number;
    balance: number;
    eurBalance: number;
    rawBalance: Hex;
};
