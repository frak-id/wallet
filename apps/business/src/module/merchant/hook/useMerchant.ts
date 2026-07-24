import { useQuery } from "@tanstack/react-query";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { merchantQueryOptions } from "@/module/merchant/queries/queryOptions";

export function useMerchant({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();
    return useQuery(merchantQueryOptions(merchantId, isDemoMode));
}
