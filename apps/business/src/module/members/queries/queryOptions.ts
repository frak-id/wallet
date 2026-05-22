import { queryOptions } from "@tanstack/react-query";
import {
    type GetMembersParam,
    getMerchantMembers,
} from "@/module/members/api/getMerchantMembers";
import { getMerchantMembersMockInitialData } from "@/module/members/api/mock";

/**
 * Builds the merchant-scoped query for the members page.
 *
 * The active merchantId is enforced server-side here (not via the global
 * `membersStore`) so prefetches and hover-preloads can't bleed the
 * currently-viewed filter across navigations.
 */
export const membersPageQueryOptions = ({
    merchantId,
    filters,
    isDemoMode,
}: {
    merchantId: string;
    filters: GetMembersParam;
    isDemoMode: boolean;
}) => {
    const scoped: GetMembersParam = {
        ...filters,
        filter: {
            ...(filters.filter ?? {}),
            merchantIds: [merchantId],
        },
    };
    return queryOptions({
        queryKey: [
            "members",
            "page",
            merchantId,
            scoped,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: () => getMerchantMembers(scoped, isDemoMode),
        staleTime: isDemoMode ? Number.POSITIVE_INFINITY : 5 * 60 * 1000,
        initialData: isDemoMode
            ? getMerchantMembersMockInitialData(scoped)
            : undefined,
    });
};
