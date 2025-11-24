import { createServerFn } from "@tanstack/react-start";
import type { Hex } from "viem";
import { indexerApi } from "@/context/api/indexerApi";
import { authMiddleware } from "@/context/auth/authMiddleware";

/**
 * Server function to get roles on product
 * Uses authMiddleware to inject wallet address from client
 */
export const getRolesOnProduct = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .inputValidator((input: { productId?: Hex | "" }) => input)
    .handler(async ({ data, context }) => {
        const { productId } = data;
        const { wallet } = context;

        if (!productId) return undefined;

        // Get roles from indexer API
        const json = await indexerApi.get(`admin/${wallet}/products`).json<
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
    });
