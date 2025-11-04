import { createServerFn } from "@tanstack/react-start";
import type { Hex } from "viem";
import { indexerApi } from "@/context/api/indexerApi";
import { getSession } from "@/context/auth/session";

/**
 * Get roles on a product
 */
async function getRolesOnProductInternal({
    productId,
}: {
    productId?: Hex | "";
}) {
    if (!productId) return undefined;

    const session = await getSession();
    if (!session) {
        throw new Error("No current session found");
    }

    // Get roles from indexer API
    const json = await indexerApi.get(`admin/${session.wallet}/products`).json<
        Array<{
            id: string;
            isOwner: boolean;
            roles: string;
        }>
    >();

    const product = json.find((p) => p.id === productId);
    if (!product) {
        return undefined;
    }

    // Parse roles (simplified - would need full role parsing logic)
    return {
        isCampaignManager: product.isOwner || BigInt(product.roles) !== 0n,
        isOwner: product.isOwner,
    };
}

/**
 * Server function to get roles on product
 */
export const getRolesOnProduct = createServerFn({ method: "GET" })
    .inputValidator((input: { productId?: Hex | "" }) => input)
    .handler(async ({ data }) => {
        return getRolesOnProductInternal({ productId: data.productId });
    });
