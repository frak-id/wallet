import { queryOptions } from "@tanstack/react-query";
import {
    type GetMembersParam,
    getMerchantMembers,
} from "@/module/members/api/getMerchantMembers";
import { getMerchantMembersMockInitialData } from "@/module/members/api/mock";

export const membersPageQueryOptions = (
    filters: GetMembersParam,
    isDemoMode: boolean
) =>
    queryOptions({
        queryKey: ["members", "page", filters, isDemoMode ? "demo" : "live"],
        queryFn: () => getMerchantMembers(filters, isDemoMode),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode
            ? getMerchantMembersMockInitialData(filters)
            : undefined,
    });
