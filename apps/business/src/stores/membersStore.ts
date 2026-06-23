import { create } from "zustand";
import type { GetMembersParam } from "@/module/members/api/getMerchantMembers";

type MembersState = {
    // Table filtering
    tableFilters: GetMembersParam;
    setTableFilters: (
        filters:
            | GetMembersParam
            | ((prevFilters: GetMembersParam) => GetMembersParam)
    ) => void;

    // Table filter count
    tableFiltersCount: number;
    setTableFiltersCount: (count: number) => void;
};

/**
 * Store for members management — table filtering and active-filter count.
 *
 * Push audiences are filter-based: the Members table no longer tracks a
 * per-row selection. The push flow reads the current `tableFilters.filter`.
 */
export const membersStore = create<MembersState>((set) => ({
    // Table filtering state
    tableFilters: {
        limit: 10,
        offset: 0,
    },

    setTableFilters: (filters) => {
        if (typeof filters === "function") {
            set((state) => ({ tableFilters: filters(state.tableFilters) }));
        } else {
            set({ tableFilters: filters });
        }
    },

    // Table filter count state
    tableFiltersCount: 0,

    setTableFiltersCount: (count) => {
        set({ tableFiltersCount: count });
    },
}));
