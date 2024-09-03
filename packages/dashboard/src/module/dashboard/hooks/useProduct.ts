import { getProduct } from "@/context/product/action/getProduct";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to get the product metadata
 */
export function useProduct({ productId }: { productId: string }) {
    return useQuery({
        queryKey: ["product", productId],
        queryFn: () => getProduct({ productId: BigInt(productId) }),
    });
}
