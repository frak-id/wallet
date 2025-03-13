import type { Address, Hex } from "viem";

export type BalanceItem = {
    token: Address;
    name: string;
    symbol: string;
    decimals: number;
    rawBalance: Hex;
    amount: number;
    eurAmount: number;
    usdAmount: number;
    gbpAmount: number;
};
