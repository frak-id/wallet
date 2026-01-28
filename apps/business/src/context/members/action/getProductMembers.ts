import { createServerFn } from "@tanstack/react-start";
import type { Hex } from "viem";
import { authMiddleware } from "@/context/auth/authMiddleware";
import {
    getProductMembersMock,
    getProductsMembersCountMock,
} from "@/context/members/action/mock";

/**
 * Local types — previously from @frak-labs/app-essentials indexer DTOs.
 * TODO: Migrate to DB-based member query once indexer is fully removed
 */
export type GetMembersPageItem = {
    user: `0x${string}`;
    totalInteractions: number;
    rewards: string;
    firstInteractionTimestamp: string;
    productIds: string[];
    productNames: string[];
};

export type GetMembersResponseDto = {
    totalResult: number;
    members: GetMembersPageItem[];
};

type GetMembersRequestDto = {
    noData?: boolean;
    onlyAddress?: boolean;
    limit?: number;
    offset?: number;
    sort?: {
        by: string;
        order: "asc" | "desc";
    };
    filter?: {
        productIds?: Hex[];
        interactions?: { min?: number; max?: number };
        rewards?: { min?: Hex; max?: Hex };
        firstInteractionTimestamp?: { min?: number; max?: number };
    };
};

export type GetMembersParam = Omit<
    GetMembersRequestDto,
    "noData" | "onlyAddress"
>;

export const getProductMembers = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: GetMembersParam) => input)
    .handler(async ({ context, data }): Promise<GetMembersResponseDto> => {
        const { isDemoMode } = context;

        if (isDemoMode) {
            return getProductMembersMock(data);
        }

        // TODO: Migrate to DB-based member query once indexer is fully removed
        console.warn("Member query not yet migrated to DB, returning empty");
        return {
            totalResult: 0,
            members: [],
        };
    });

export const getProductsMembersCount = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator(
        (input: Omit<GetMembersParam, "limit" | "offset" | "sort">) => input
    )
    .handler(async ({ context, data }): Promise<number> => {
        const { isDemoMode } = context;

        if (isDemoMode) {
            return getProductsMembersCountMock(data);
        }

        // TODO: Migrate to DB-based member query once indexer is fully removed
        console.warn("Member count query not yet migrated to DB, returning 0");
        return 0;
    });
