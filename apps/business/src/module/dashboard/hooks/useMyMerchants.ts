import { useSuspenseQuery } from "@tanstack/react-query";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { myMerchantsQueryOptions } from "@/module/merchant/queries/queryOptions";

export function useMyMerchants() {
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(myMerchantsQueryOptions(isDemoMode));

    // Combine owned and admin merchants into a single list
    const merchants = [...(data.owned ?? []), ...(data.adminOf ?? [])];

    return {
        isEmpty: merchants.length === 0,
        merchants,
        owned: data.owned ?? [],
        adminOf: data.adminOf ?? [],
    };
}
