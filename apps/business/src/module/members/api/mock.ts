import type { Hex } from "viem";
import membersData from "@/mock/members.json";
import type {
    GetMembersPageItem,
    GetMembersParam,
    GetMembersResponseDto,
} from "@/module/members/api/getMerchantMembers";

type MemberData = {
    user: string;
    totalInteractions: number;
    totalRewardsUsd: number;
    firstInteractionTimestamp: string;
    merchantIds: string[];
    productNames: string[];
};

function filterByMerchantIds(
    members: MemberData[],
    merchantIds: Hex[]
): MemberData[] {
    return members.filter((member) =>
        member.merchantIds.some((id) => merchantIds.includes(id as Hex))
    );
}

function filterByInteractions(
    members: MemberData[],
    interactions: { min?: number; max?: number }
): MemberData[] {
    let filtered = members;

    if (interactions.min !== undefined) {
        const minValue = interactions.min;
        filtered = filtered.filter(
            (member) => member.totalInteractions >= minValue
        );
    }

    if (interactions.max !== undefined) {
        const maxValue = interactions.max;
        filtered = filtered.filter(
            (member) => member.totalInteractions <= maxValue
        );
    }

    return filtered;
}

function filterByTimestamp(
    members: MemberData[],
    timestamp: { min?: number; max?: number }
): MemberData[] {
    let filtered = members;

    if (timestamp.min !== undefined) {
        const minValue = timestamp.min;
        filtered = filtered.filter(
            (member) =>
                Number.parseInt(member.firstInteractionTimestamp, 10) >=
                minValue
        );
    }

    if (timestamp.max !== undefined) {
        const maxValue = timestamp.max;
        filtered = filtered.filter(
            (member) =>
                Number.parseInt(member.firstInteractionTimestamp, 10) <=
                maxValue
        );
    }

    return filtered;
}

function applyFilters(
    members: MemberData[],
    filter: GetMembersParam["filter"]
): MemberData[] {
    let filtered = members;

    if (!filter) {
        return filtered;
    }

    if (filter.merchantIds && filter.merchantIds.length > 0) {
        filtered = filterByMerchantIds(filtered, filter.merchantIds);
    }

    if (filter.interactions) {
        filtered = filterByInteractions(filtered, filter.interactions);
    }

    if (filter.firstInteractionTimestamp) {
        filtered = filterByTimestamp(
            filtered,
            filter.firstInteractionTimestamp
        );
    }

    return filtered;
}

function getMembersMockSync(params: GetMembersParam): GetMembersResponseDto {
    const { limit = 20, offset = 0, sort, filter } = params;

    let filteredMembers = [...membersData.members];
    filteredMembers = applyFilters(filteredMembers, filter);

    if (sort) {
        filteredMembers.sort((a, b) => {
            let comparison = 0;

            switch (sort.by) {
                case "user":
                    comparison = a.user.localeCompare(b.user);
                    break;
                case "totalInteractions":
                    comparison = a.totalInteractions - b.totalInteractions;
                    break;
                case "totalRewardsUsd":
                    comparison = a.totalRewardsUsd - b.totalRewardsUsd;
                    break;
                case "firstInteractionTimestamp":
                    comparison =
                        Number.parseInt(a.firstInteractionTimestamp, 10) -
                        Number.parseInt(b.firstInteractionTimestamp, 10);
                    break;
            }

            return sort.order === "desc" ? -comparison : comparison;
        });
    }

    const paginatedMembers = filteredMembers.slice(offset, offset + limit);

    const mappedMembers = paginatedMembers.map((m) => ({
        ...m,
        merchantIds: m.merchantIds,
        merchantNames: m.productNames,
    }));

    return {
        totalResult: filteredMembers.length,
        members: mappedMembers as unknown as GetMembersPageItem[],
    };
}

export async function getMerchantMembersMock(
    params: GetMembersParam
): Promise<GetMembersResponseDto> {
    return getMembersMockSync(params);
}

/**
 * Synchronous version for TanStack Query initialData
 */
export function getMerchantMembersMockInitialData(
    params: GetMembersParam
): GetMembersResponseDto {
    return getMembersMockSync(params);
}

export async function getMerchantsMembersCountMock(
    params: Omit<GetMembersParam, "limit" | "offset" | "sort">
): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const { filter } = params;
    let filteredMembers = [...membersData.members];
    filteredMembers = applyFilters(filteredMembers, filter);

    return filteredMembers.length;
}
