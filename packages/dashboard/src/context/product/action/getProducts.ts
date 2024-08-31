"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import ky from "ky";
import type { Address } from "viem";

type ApiResult = {
    id: string; // bigint
    isOwner: number; // bool, 0 false 1 true
    roles: string; // bigint
    domain: string;
    name: string;
    contentTypes: string; //bigint
}[];

type GetContentsResult = {
    owner: { id: bigint; name: string; domain: string }[];
    operator: { id: bigint; name: string; domain: string }[];
};

/**
 * Get all the user products
 */
async function getProducts({ wallet }: { wallet: Address }) {
    // Get our api results
    const json = await ky
        .get(`https://indexer.frak.id/admin/${wallet}/products`)
        .json<ApiResult>();

    // Map it to the form: { owner: [contents], operator: [contents] }
    return (
        json.reduce(
            (acc: GetContentsResult, item: ApiResult[number]) => {
                // Map our product
                const mappedContent = {
                    id: BigInt(item.id),
                    name: item.name,
                    domain: item.domain,
                };

                // Push it in the right list
                if (item.isOwner === 1) {
                    acc.owner.push(mappedContent);
                } else {
                    // todo: check roles
                    acc.operator.push(mappedContent);
                }
                return acc;
            },
            { owner: [], operator: [] }
        ) ?? { owner: [], operator: [] }
    );
}

/**
 * Get the products for the current user
 */
export async function getMyProducts() {
    const session = await getSafeSession();
    return getProducts({ wallet: session.wallet });
}
