"use server";

import membersData from "@/mock/members.json";
import type {
    GetMembersPageItem,
    GetMembersRequestDto,
    GetMembersResponseDto,
} from "@frak-labs/app-essentials";
import type { Hex } from "viem";

type GetMembersParam = Omit<GetMembersRequestDto, "noData" | "onlyAddress">;

type MemberData = {
    user: string;
    totalInteractions: number;
    rewards: string;
    firstInteractionTimestamp: string;
    productIds: string[];
    productNames: string[];
};

/**
 * Filter members by product IDs
 */
function filterByProductIds(
    members: MemberData[],
    productIds: Hex[]
): MemberData[] {
    return members.filter((member) =>
        member.productIds.some((productId) =>
            productIds.includes(productId as Hex)
        )
    );
}

/**
 * Filter members by interaction count
 */
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

/**
 * Filter members by first interaction timestamp
 */
function filterByTimestamp(
    members: MemberData[],
    timestamp: { min?: number; max?: number }
): MemberData[] {
    let filtered = members;

    if (timestamp.min !== undefined) {
        const minValue = timestamp.min;
        filtered = filtered.filter(
            (member) =>
                Number.parseInt(member.firstInteractionTimestamp) >= minValue
        );
    }

    if (timestamp.max !== undefined) {
        const maxValue = timestamp.max;
        filtered = filtered.filter(
            (member) =>
                Number.parseInt(member.firstInteractionTimestamp) <= maxValue
        );
    }

    return filtered;
}

/**
 * Apply all filters to members
 */
function applyFilters(
    members: MemberData[],
    filter: GetMembersParam["filter"]
): MemberData[] {
    let filtered = members;

    if (!filter) {
        return filtered;
    }

    if (filter.productIds && filter.productIds.length > 0) {
        filtered = filterByProductIds(filtered, filter.productIds);
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

/**
 * Mock implementation of getProductMembers for demo mode
 * Returns paginated mock member data with a realistic delay
 */
export async function getProductMembersMock(
    params: GetMembersParam
): Promise<GetMembersResponseDto> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 350));

    const { limit = 20, offset = 0, sort, filter } = params;

    // Get all members from mock data
    let filteredMembers = [...membersData.members];

    // Apply filters
    filteredMembers = applyFilters(filteredMembers, filter);

    // Apply sorting if provided
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
                case "rewards":
                    comparison =
                        Number.parseInt(a.rewards) - Number.parseInt(b.rewards);
                    break;
                case "firstInteractionTimestamp":
                    comparison =
                        Number.parseInt(a.firstInteractionTimestamp) -
                        Number.parseInt(b.firstInteractionTimestamp);
                    break;
            }

            return sort.order === "desc" ? -comparison : comparison;
        });
    }

    // Apply pagination
    const paginatedMembers = filteredMembers.slice(offset, offset + limit);

    return {
        totalResult: filteredMembers.length,
        members: paginatedMembers as unknown as GetMembersPageItem[],
    };
}

/**
 * Mock implementation of getProductsMembersCount for demo mode
 * Returns count of mock members matching the criteria
 */
export async function getProductsMembersCountMock(
    params: Omit<GetMembersParam, "limit" | "offset" | "sort">
): Promise<number> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    const { filter } = params;

    // Get all members from mock data
    let filteredMembers = [...membersData.members];

    // Apply filters using the same helper function
    filteredMembers = applyFilters(filteredMembers, filter);

    return filteredMembers.length;
}
