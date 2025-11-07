import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getMyProducts } from "@/context/product/action/getProducts";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

/**
 * Hook to get all the current user products
 */
export function useMyProducts() {
    const isDemoMode = useIsDemoMode();

    const { data, isPending } = useQuery({
        queryKey: ["product", "get-mine", isDemoMode ? "demo" : "live"],
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
