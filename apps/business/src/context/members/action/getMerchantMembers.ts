import type { Hex } from "viem";
import {
    getMerchantMembersMock,
    getMerchantsMembersCountMock,
} from "@/context/members/action/mock";

// TODO: [BACKEND-V2] Migrate to backend API once member endpoints are available
// Currently returns empty results in non-demo mode
// Backend ticket: https://linear.app/frak/issue/FRAK-XXX

export type GetMembersPageItem = {
    user: `0x${string}`;
    totalInteractions: number;
    rewards: string;
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
        rewards?: { min?: Hex; max?: Hex };
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

    // TODO: [BACKEND-V2] Call backend API: authenticatedBackendApi.merchant.members.post(params)
    return {
        totalResult: 0,
        members: [],
    };
}

export async function getMerchantsMembersCount(
    params: Omit<GetMembersParam, "limit" | "offset" | "sort">,
    isDemoMode: boolean
): Promise<number> {
    if (isDemoMode) {
        return getMerchantsMembersCountMock(params);
    }

    // TODO: [BACKEND-V2] Call backend API: authenticatedBackendApi.merchant.members.count.post(params)
    return 0;
}
