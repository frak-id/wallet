import { useSuspenseQuery } from "@tanstack/react-query";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { myProductsQueryOptions } from "@/module/dashboard/queries/queryOptions";

export function useMyProducts() {
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(myProductsQueryOptions(isDemoMode));

    return {
        isEmpty: data.owner.length === 0 && data.operator.length === 0,
        products: data,
    };
}
