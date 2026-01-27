import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";
import { getMyProductsMock } from "@/context/product/action/mock";

export type GetProductResult = {
    owner: { id: string; name: string; domain: string }[];
    operator: { id: string; name: string; domain: string }[];
};

/**
 * Get all the user products (merchants) from the backend API
 */
async function getProducts(): Promise<GetProductResult> {
    const { data, error } = await authenticatedBackendApi.merchant.my.get();

    if (!data || error) {
        console.warn("Error when fetching products", error);
        return { owner: [], operator: [] };
    }

    return {
        owner: data.owned.map((m) => ({
            id: m.id,
            name: m.name,
            domain: m.domain,
        })),
        operator: data.adminOf.map((m) => ({
            id: m.id,
            name: m.name,
            domain: m.domain,
        })),
    };
}

/**
 * Get the products for the current user
 */
export const getMyProducts = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .handler(async ({ context }) => {
        const { isDemoMode } = context;

        // Check if demo mode is active
        if (isDemoMode) {
            return getMyProductsMock();
        }

        return getProducts();
    });
