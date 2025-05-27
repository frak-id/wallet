import type { Hex } from "viem";

export type RewardHistory = {
    type: "add" | "claim";
    amount: number;
    txHash: Hex;
    timestamp: number; // timestamp in seconds
    productId: string;
    productName: string;
};
