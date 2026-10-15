import { create } from "zustand";
import type { IbanEntry } from "./ibanStore";

/**
 * Transfer sub-flow screens. Setup screens are derived from the status
 * query and never stored.
 */
export type MoneriumTransferScreen =
    | "transfer-amount"
    | "transfer-recap"
    | "transfer-iban";

type MoneriumFlowState = {
    screen: MoneriumTransferScreen;

    amount: string;
    note: string;
    selectedIbanOverride: IbanEntry | null;

    goTo: (screen: MoneriumTransferScreen) => void;
    setAmount: (amount: string) => void;
    setNote: (note: string) => void;
    setSelectedIban: (entry: IbanEntry | null) => void;
    /** Reset the transfer sub-flow (called on flow close). */
    resetTransfer: () => void;
};

const transferDefaults = {
    screen: "transfer-amount",
    amount: "",
    note: "",
    selectedIbanOverride: null,
} as const;

/** Not persisted: transfer form data resets on flow close. */
export const moneriumFlowStore = create<MoneriumFlowState>()((set) => ({
    ...transferDefaults,

    goTo: (screen) => set({ screen }),
    setAmount: (amount) => set({ amount }),
    setNote: (note) => set({ note }),
    setSelectedIban: (selectedIbanOverride) => set({ selectedIbanOverride }),
    resetTransfer: () => set({ ...transferDefaults }),
}));

export const selectScreen = (s: MoneriumFlowState) => s.screen;
export const selectAmount = (s: MoneriumFlowState) => s.amount;
export const selectNote = (s: MoneriumFlowState) => s.note;
export const selectSelectedIbanOverride = (s: MoneriumFlowState) =>
    s.selectedIbanOverride;
