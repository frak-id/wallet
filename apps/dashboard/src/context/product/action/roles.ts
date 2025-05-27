import { businessApi } from "@frak-labs/shared/context/server";
import { cookies } from "next/headers";
import type { Hex } from "viem";

/**
 * Get the current user roles on a given product
 * @param productId
 */
export async function getRolesOnProduct({
    productId,
}: { productId?: Hex | "" }) {
    if (!productId) return undefined;

    const stringCookie = (await cookies()).toString();
    const { data, error } = await businessApi.roles.index.get({
        query: { productId },
        fetch: {
            headers: {
                cookie: stringCookie,
            },
        },
    });
    if (!data) {
        console.warn("Error when fetching user roles", error);
        return undefined;
    }
    return data;
}
