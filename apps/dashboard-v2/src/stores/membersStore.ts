import { unique } from "radash";
import { type Address, getAddress, isAddressEqual } from "viem";
import { create } from "zustand";
import type { GetMembersParam } from "@/context/members/action/getProductMembers";

type MembersState = {
    // Member selection
    selectedMembers: Address[] | undefined;
    addMember: (address: Address) => void;
    removeMember: (address: Address) => void;
    clearSelection: () => void;

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
 * Store for members management
 * Handles member selection, table filtering, and filter counts
 */
export const membersStore = create<MembersState>((set, get) => ({
    // Member selection state
    selectedMembers: undefined,

    addMember: (address) => {
        const selectedMembers = get().selectedMembers;
        if (selectedMembers) {
            // Deduplicate the selected members
            const newSelectedMembers = [...selectedMembers, address];
            set({ selectedMembers: unique(newSelectedMembers, getAddress) });
        } else {
            set({ selectedMembers: [address] });
        }
    },

    removeMember: (address) => {
        const selectedMembers = get().selectedMembers;
        if (selectedMembers) {
            set({
                selectedMembers: selectedMembers.filter(
                    (a) => !isAddressEqual(a, address)
                ),
            });
        }
    },

    clearSelection: () => {
        set({ selectedMembers: undefined });
    },

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
