"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import type { MembersPageItem } from "@/types/Members";
import ky from "ky";

type GetMembersParam = {
    // Indicating if we only want the total count
    noData?: boolean;
    // Some filters to apply to the query
    filter?: {
        productIds?: string[];
        interactions?: {
            min?: number;
            max?: number;
        };
        rewards?: {
            min?: number;
            max?: number;
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

type GetMembersResponse = {
    totalCount: number;
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
