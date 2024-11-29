"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import type {
    GetMembersCountResponseDto,
    GetMembersRequestDto,
    GetMembersResponseDto,
} from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/shared/context/server";

export type GetMembersParam = Omit<
    GetMembersRequestDto,
    "noData" | "onlyAddress"
>;

/**
 * Fetch the members of a product
 * @param params
 */
export async function getProductMembers(params: GetMembersParam) {
    const session = await getSafeSession();

    return await indexerApi
        .get(`members/${session.wallet}`, {
            json: params,
        })
        .json<GetMembersResponseDto>();
}

/**
 * Count the number of mumbers for a product matching the given criteria
 * @param params
 */
export async function getProductsMembersCount(
    params: Omit<GetMembersParam, "limit" | "offset" | "sort">
) {
    const session = await getSafeSession();

    const result = await indexerApi
        .get(`members/${session.wallet}`, {
            json: { ...params, noData: true },
        })
        .json<GetMembersCountResponseDto>();
    return result.totalResult;
}
