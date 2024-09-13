import type { Address } from "viem";

export type MembersPageItem = {
    user: Address;
    totalInteractions: number;
    rewards: string; // bigint
    firstInteractionTimestamp: string; // number (timestamp)
    productIds: string[]; // bigint[]
    productNames: string[];
};
