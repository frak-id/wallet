"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import type {
    GetMembersCountResponseDto,
    GetMembersRequestDto,
    GetMembersResponseDto,
} from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/client/server";

export type GetMembersParam = Omit<
    GetMembersRequestDto,
    "noData" | "onlyAddress"
>;

/**
 * Fetch the members of a product
 * @param params
 */
export async function getProductMembers(params: GetMembersParam) {
    try {
        const session = await getSafeSession();

        return await indexerApi
            .post(`members/${session.wallet}`, {
                json: params,
            })
            .json<GetMembersResponseDto>();
    } catch (e) {
        console.warn("Failed to fetch members", e);
        return {
            totalResult: 0,
            members: [],
        };
    }
}

/**
 * Count the number of mumbers for a product matching the given criteria
 * @param params
 */
export async function getProductsMembersCount(
    params: Omit<GetMembersParam, "limit" | "offset" | "sort">
) {
    try {
        const session = await getSafeSession();

        const result = await indexerApi
            .post(`members/${session.wallet}`, {
                json: { ...params, noData: true },
            })
            .json<GetMembersCountResponseDto>();
        return result.totalResult;
    } catch (e) {
        console.warn("Failed to fetch members count", e);
        return 0;
    }
}
