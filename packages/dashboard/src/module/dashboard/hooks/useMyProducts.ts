import { getMyProducts } from "@/context/product/action/getProducts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Hook to get all the current user products
 */
export function useMyProducts() {
    const { data, isPending } = useQuery({
        queryKey: ["my-products"],
        queryFn: () => getMyProducts(),
    });

    return useMemo(() => {
        return {
            isEmpty:
                !data ||
                (data.owner.length === 0 && data.operator.length === 0),
            products: data,
            isPending,
        };
    }, [data, isPending]);
}
