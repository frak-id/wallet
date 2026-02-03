import { queryOptions } from "@tanstack/react-query";
import productsMockData from "@/mock/products.json";
import { getMyMerchants } from "@/module/merchant/api/getMerchants";

export const myMerchantsQueryOptions = (isDemoMode: boolean) =>
    queryOptions({
        queryKey: ["merchant", "get-mine", isDemoMode ? "demo" : "live"],
        queryFn: () => getMyMerchants(isDemoMode),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode ? productsMockData : undefined,
    });
