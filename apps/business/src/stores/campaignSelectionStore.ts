import { create } from "zustand";

type CampaignSelectionState = {
    selectedIds: Set<string>;
    toggle: (id: string) => void;
    setMany: (ids: string[]) => void;
    clear: () => void;
};

export const campaignSelectionStore = create<CampaignSelectionState>((set) => ({
    selectedIds: new Set<string>(),
    toggle: (id) =>
        set((state) => {
            const next = new Set(state.selectedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return { selectedIds: next };
        }),
    setMany: (ids) => set({ selectedIds: new Set(ids) }),
    clear: () => set({ selectedIds: new Set<string>() }),
}));
