"use server";

import { getSafeSession } from "@/context/auth/actions/session";
import { indexerApi } from "@frak-labs/shared/context/server";
import { type Address, type Hex, toHex } from "viem";

type ApiResult = {
    id: string; // bigint
    isOwner: number; // bool, 0 false 1 true
    roles: string; // bigint
    domain: string;
    name: string;
    productTypes: string; //bigint
}[];

type GetProductResult = {
    owner: { id: Hex; name: string; domain: string }[];
    operator: { id: Hex; name: string; domain: string }[];
};

/**
 * Get all the user products
 */
async function getProducts({ wallet }: { wallet: Address }) {
    // Get our api results
    const json = await indexerApi
        .get(`admin/${wallet}/products`)
        .json<ApiResult>();

    // Map it to the form: { owner: [contents], operator: [contents] }
    return (
        json.reduce(
            (acc: GetProductResult, item: ApiResult[number]) => {
                // Map our product
                const mappedProduct = {
                    id: toHex(BigInt(item.id)),
                    name: item.name,
                    domain: item.domain,
                };

                // Push it in the right list
                if (item.isOwner === 1) {
                    acc.owner.push(mappedProduct);
                } else {
                    // todo: check roles
                    acc.operator.push(mappedProduct);
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
