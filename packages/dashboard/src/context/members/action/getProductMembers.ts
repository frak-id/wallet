"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import type { MembersPageItem } from "@/types/Members";
import ky from "ky";
import type { Address, Hex } from "viem";

type GetMembersRequest = {
    // Indicating if we only want the total count
    noData?: boolean;
    // Indicating if we only want the address
    onlyAddress?: boolean;
    // Some filters to apply to the query
    filter?: {
        productIds?: string[];
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

export type GetMembersParam = Omit<GetMembersRequest, "noData" | "onlyAddress">;

/**
 * Full get members response
 */
type GetMembersResponse = {
    totalResult: number;
    members: MembersPageItem[];
};

/**
 * Fetch the members of a product
 * @param params
 */
export async function getProductMembers(params: GetMembersParam) {
    const session = await getSafeSession();

    return await ky
        .post(`https://indexer.frak.id/members/${session.wallet}`, {
            json: params,
        })
        .json<GetMembersResponse>();
}

/**
 * Count the number of mumbers for a product matching the given criteria
 * @param params
 */
export async function getProductsMembersCount(
    params: Omit<GetMembersParam, "limit" | "offset" | "sort">
) {
    const session = await getSafeSession();

    const result = await ky
        .post(`https://indexer.frak.id/members/${session.wallet}`, {
            json: { ...params, noData: true },
        })
        .json<Omit<GetMembersResponse, "members">>();
    return result.totalResult;
}

/**
 * Fetch the members of a product
 * @param params
 */
export async function getProductsMembersAddress(params: GetMembersParam) {
    const session = await getSafeSession();

    return await ky
        .post(`https://indexer.frak.id/members/${session.wallet}`, {
            json: { ...params, onlyAddress: true },
        })
        .json<Omit<GetMembersResponse, "members"> & { users: Address[] }>();
}
