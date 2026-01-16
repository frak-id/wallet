import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

export function useMyMerchants() {
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(myMerchantsQueryOptions(isDemoMode));

    // Combine owned and admin merchants into a single list
    // CRITICAL: useMemo prevents new array on every render (would cause infinite loops in useEffect)
    const merchants = useMemo(
        () => [...(data.owned ?? []), ...(data.adminOf ?? [])],
        [data.owned, data.adminOf]
    );

    return {
        isEmpty: merchants.length === 0,
        merchants,
        owned: data.owned ?? [],
        adminOf: data.adminOf ?? [],
    };
}
