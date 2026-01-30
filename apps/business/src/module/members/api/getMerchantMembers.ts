import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    getMerchantMembersMock,
    getMerchantsMembersCountMock,
} from "@/module/members/api/mock";

export type GetMembersPageItem = {
    user: `0x${string}`;
    totalInteractions: number;
    totalRewardsUsd: number;
    firstInteractionTimestamp: string;
    merchantIds: string[];
    merchantNames: string[];
};

export type GetMembersResponseDto = {
    totalResult: number;
    members: GetMembersPageItem[];
};

export type GetMembersParam = {
    limit?: number;
    offset?: number;
    sort?: {
        by: string;
        order: "asc" | "desc";
    };
    filter?: {
        merchantIds?: Hex[];
        interactions?: { min?: number; max?: number };
        firstInteractionTimestamp?: { min?: number; max?: number };
    };
};

export async function getMerchantMembers(
    params: GetMembersParam,
    isDemoMode: boolean
): Promise<GetMembersResponseDto> {
    if (isDemoMode) {
        return getMerchantMembersMock(params);
    }

    const { data, error } = await authenticatedBackendApi.merchant.members.post(
        {
            limit: params.limit,
            offset: params.offset,
            sort: params.sort,
            filter: params.filter
                ? {
                      merchantIds: params.filter.merchantIds as
                          | string[]
                          | undefined,
                      interactions: params.filter.interactions,
                      firstInteractionTimestamp:
                          params.filter.firstInteractionTimestamp,
                  }
                : undefined,
        }
    );

    if (error || !data) {
        return { totalResult: 0, members: [] };
    }

    return data;
}

export async function getMerchantsMembersCount(
    params: Omit<GetMembersParam, "limit" | "offset" | "sort">,
    isDemoMode: boolean
): Promise<number> {
    if (isDemoMode) {
        return getMerchantsMembersCountMock(params);
    }

    const { data, error } =
        await authenticatedBackendApi.merchant.members.count.post({
            filter: params.filter
                ? {
                      merchantIds: params.filter.merchantIds as
                          | string[]
                          | undefined,
                      interactions: params.filter.interactions,
                      firstInteractionTimestamp:
                          params.filter.firstInteractionTimestamp,
                  }
                : undefined,
        });

    if (error || !data) {
        return 0;
    }

    return data.count;
}
