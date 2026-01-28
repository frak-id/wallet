import { useSuspenseQuery } from "@tanstack/react-query";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { myMerchantsQueryOptions } from "@/module/dashboard/queries/queryOptions";

export function useMyMerchants() {
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(myMerchantsQueryOptions(isDemoMode));

    return {
        isEmpty: data.owner.length === 0 && data.operator.length === 0,
        merchants: data,
    };
}

/**
 * @deprecated Use useMyMerchants instead
 */
export const useMyProducts = useMyMerchants;
