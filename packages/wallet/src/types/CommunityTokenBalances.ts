import type { Address } from "viem";

export type CommunityTokenBalance = {
    contractAddress: Address;
    balance: bigint;
    tokenId: bigint;
};
