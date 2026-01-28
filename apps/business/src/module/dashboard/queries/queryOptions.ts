import { queryOptions } from "@tanstack/react-query";
import { getMyMerchants } from "@/context/merchant/action/getMerchants";

export const myMerchantsQueryOptions = (isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["merchant", "get-mine", isDemoMode ? "demo" : "live"],
        queryFn: () => getMyMerchants(isDemoMode),
        staleTime: 5 * 60 * 1000,
    });
