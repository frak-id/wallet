import type { Address, Hex } from "viem";

export type GetMembersWalletResponseDto = {
    totalResult: number;
    users: Address[];
};

export type GetMembersCountResponseDto = {
    totalResult: number;
};

export type GetMembersPageItem = {
    user: Address;
    totalInteractions: number;
    rewards: string; // bigint
    firstInteractionTimestamp: string; // number (timestamp)
    productIds: string[]; // bigint[]
    productNames: string[];
};

export type GetMembersResponseDto = {
    totalResult: number;
    members: GetMembersPageItem[];
};

export type GetMembersRequestDto = {
    // Indicating if we only want the total count
    noData?: boolean;
    // Indicating if we only want the address
    onlyAddress?: boolean;
    // Some filters to apply to the query
    filter?: {
        productIds?: Hex[];
        interactions?: {
            min?: number;
            max?: number;
        };
        rewards?: {
            min?: Hex;
            max?: Hex;
        };
        firstInteractionTimestamp?: {
            min?: number;
            max?: number;
        };
    };
    // Some sorting options to apply
    sort?: {
        by:
            | "user"
            | "totalInteractions"
            | "rewards"
            | "firstInteractionTimestamp";
        order: "asc" | "desc";
    };
    // Pagination options
    limit?: number;
    offset?: number;
};
