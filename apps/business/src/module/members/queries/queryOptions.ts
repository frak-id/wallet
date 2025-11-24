import { queryOptions } from "@tanstack/react-query";
import {
    type GetMembersParam,
    getProductMembers,
} from "@/context/members/action/getProductMembers";

/**
 * Query options for fetching members with filtering and pagination
 */
export const membersPageQueryOptions = (filters: GetMembersParam) =>
    queryOptions({
        queryKey: ["members", "page", filters],
        queryFn: async () => {
            return await getProductMembers({ data: filters });
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
