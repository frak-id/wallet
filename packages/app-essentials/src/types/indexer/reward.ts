import type { Address, Hex } from "viem";
import type { IndexerToken } from "./common";

export type GetRewardResponseDto = {
    rewards: {
        amount: string;
        address: Address;
        token: Address;
    }[];
    tokens: IndexerToken[];
};

export type GetRewardHistoryResponseDto = {
    added: {
        amount: string;
        timestamp: string;
        txHash: Hex;
        productId: string;
        productName: string;
        token: Address;
    }[];
    claimed: {
        amount: string;
        timestamp: string;
        txHash: Hex;
        productId: string;
        productName: string;
        token: Address;
    }[];
    tokens: IndexerToken[];
};
