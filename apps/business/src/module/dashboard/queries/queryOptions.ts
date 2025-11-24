import { queryOptions } from "@tanstack/react-query";
import { getMyProducts } from "@/context/product/action/getProducts";

/**
 * Query options for fetching user's products
 */
export const myProductsQueryOptions = (isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["product", "get-mine", isDemoMode ? "demo" : "live"],
        queryFn: () => getMyProducts(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
