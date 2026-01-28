import { queryOptions } from "@tanstack/react-query";
import {
    type GetMembersParam,
    getMerchantMembers,
} from "@/context/members/action/getMerchantMembers";

export const membersPageQueryOptions = (
    filters: GetMembersParam,
    isDemoMode: boolean
) =>
    queryOptions({
        queryKey: ["members", "page", filters, isDemoMode ? "demo" : "live"],
        queryFn: () => getMerchantMembers(filters, isDemoMode),
        staleTime: 5 * 60 * 1000,
    });
