import { create } from "zustand";

/**
 * Sort options for the Explorer merchant list, ordered as they appear in the
 * "Sort by" bottom sheet.
 */
export type ExplorerSort = "popular" | "reward" | "expiring" | "recent";

/**
 * Default order shown when the user hasn't picked a sort yet. Kept in sync
 * with the backend's implicit ordering so the red-dot indicator only lights
 * up once the user actively diverges from it.
 */
export const DEFAULT_EXPLORER_SORT: ExplorerSort = "popular";

/**
 * The sort options in display order, paired with their i18n label keys. Single
 * source of truth for the bottom sheet's radio list and the header button's
 * active-sort announcement.
 */
export const EXPLORER_SORT_OPTIONS: {
    value: ExplorerSort;
    labelKey: string;
}[] = [
    { value: "popular", labelKey: "explorer.sort.popular" },
    { value: "reward", labelKey: "explorer.sort.reward" },
    { value: "expiring", labelKey: "explorer.sort.expiring" },
    { value: "recent", labelKey: "explorer.sort.recent" },
];

type ExplorerSortStore = {
    sort: ExplorerSort;
    setSort: (sort: ExplorerSort) => void;
};

/**
 * Holds the applied Explorer sort so the header button (red-dot indicator),
 * the merchant list query, and the sort bottom sheet all read a single source
 * of truth.
 */
export const explorerSortStore = create<ExplorerSortStore>()((set) => ({
    sort: DEFAULT_EXPLORER_SORT,
    setSort: (sort) => set({ sort }),
}));

/** True when a non-default sort is applied — drives the red-dot indicator. */
export function isCustomExplorerSort(sort: ExplorerSort): boolean {
    return sort !== DEFAULT_EXPLORER_SORT;
}
