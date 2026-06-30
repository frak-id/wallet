import type { DateRange } from "react-day-picker";
import { create } from "zustand";
import type { PushHistoryStatus } from "@/module/members/component/PushHistory/types";

/**
 * Client-side filters for the push history table: a `dateRange` window on the
 * broadcast's scheduled/sent time and a `status` multi-select.
 */
export type PushHistoryFilters = {
    dateRange?: DateRange;
    status?: PushHistoryStatus[];
};

type PushHistoryState = {
    filters: PushHistoryFilters;
    setFilters: (
        filters:
            | PushHistoryFilters
            | ((prev: PushHistoryFilters) => PushHistoryFilters)
    ) => void;
};

export const pushHistoryStore = create<PushHistoryState>((set) => ({
    filters: {},
    setFilters: (filters) =>
        set((state) => ({
            filters:
                typeof filters === "function"
                    ? filters(state.filters)
                    : filters,
        })),
}));
