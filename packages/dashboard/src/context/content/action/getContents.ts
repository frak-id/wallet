"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import ky from "ky";
import type { Address } from "viem";

type ApiResult = {
    id: string; // bigint
    isContentOwner: number; // bool, 0 false 1 true
    domain: string;
    name: string;
    contentTypes: string; //bigint
}[];

type GetContentsResult = {
    owner: { id: bigint; name: string; domain: string }[];
    operator: { id: bigint; name: string; domain: string }[];
};

/**
 * Get all the user contents
 * todo: should have a caching layer
 */
export async function getContents({ wallet }: { wallet: Address }) {
    // Get our api results
    const json = await ky
        .get(`https://indexer.frak.id/admin/${wallet}/contents`)
        .json<ApiResult>();

    // Map it to the form: { owner: [contents], operator: [contents] }
    return (
        json.reduce(
            (acc: GetContentsResult, item: ApiResult[number]) => {
                // Map our content
                const mappedContent = {
                    id: BigInt(item.id),
                    name: item.name,
                    domain: item.domain,
                };

                // Push it in the right list
                if (item.isContentOwner === 1) {
                    acc.owner.push(mappedContent);
                } else {
                    acc.operator.push(mappedContent);
                }
                return acc;
            },
            { owner: [], operator: [] }
        ) ?? { owner: [], operator: [] }
    );
}

/**
 * Get the contents for the current user
 */
export async function getMyContents() {
    const session = await getSafeSession();
    return getContents({ wallet: session.wallet });
}
