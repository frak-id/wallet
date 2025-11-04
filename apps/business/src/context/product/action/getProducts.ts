import { createServerFn } from "@tanstack/react-start";
import { type Address, type Hex, toHex } from "viem";
import { indexerApi } from "@/context/api/indexerApi";
import { getSafeSession } from "@/context/auth/session";
import { getMyProductsMock } from "@/context/product/action/mock";
import { isDemoModeActive } from "@/module/common/utils/isDemoMode";

type ApiResult = {
    id: string; // bigint
    isOwner: boolean;
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
                if (item.isOwner) {
                    acc.owner.push(mappedProduct);
                } else if (BigInt(item.roles) !== 0n) {
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
export const getMyProducts = createServerFn({ method: "GET" }).handler(
    async () => {
        // Check if demo mode is active
        if (await isDemoModeActive()) {
            return getMyProductsMock();
        }

        const session = await getSafeSession();
        return getProducts({ wallet: session.wallet });
    }
);
