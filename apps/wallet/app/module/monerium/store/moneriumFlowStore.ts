import { create } from "zustand";
import type { IbanEntry } from "./ibanStore";

/**
 * Every screen in the Monerium bank-flow, flattened into a single enum.
 * Setup screens (info → kyc → link → success) are auto-driven by
 * `useMoneriumFlowSync`; transfer screens are navigated imperatively.
 */
export type MoneriumFlowScreen =
    | "loading"
    | "info"
    | "kyc"
    | "link"
    | "success"
    | "transfer-amount"
    | "transfer-recap"
    | "transfer-iban";

type MoneriumFlowState = {
    /** Current visible screen. */
    screen: MoneriumFlowScreen;

    /* ── Transfer form data (survives screen transitions) ────────── */
    amount: string;
    note: string;
    selectedIbanOverride: IbanEntry | null;

    /* ── Actions ─────────────────────────────────────────────────── */
    goTo: (screen: MoneriumFlowScreen) => void;
    setAmount: (amount: string) => void;
    setNote: (note: string) => void;
    setSelectedIban: (entry: IbanEntry | null) => void;
    /** Reset transfer form data (called on flow close). */
    resetTransfer: () => void;
};

const transferDefaults = {
    amount: "",
    note: "",
    selectedIbanOverride: null,
} as const;

/**
 * Single source of truth for the Monerium bank-flow navigation and
 * transfer form state.  NOT persisted — form data resets on flow close.
 */
export const moneriumFlowStore = create<MoneriumFlowState>()((set) => ({
    screen: "loading",
    ...transferDefaults,

    goTo: (screen) => set({ screen }),
    setAmount: (amount) => set({ amount }),
    setNote: (note) => set({ note }),
    setSelectedIban: (selectedIbanOverride) => set({ selectedIbanOverride }),
    resetTransfer: () => set({ ...transferDefaults, screen: "loading" }),
}));

/* ── Selectors ───────────────────────────────────────────────────── */

export const selectScreen = (s: MoneriumFlowState) => s.screen;
export const selectAmount = (s: MoneriumFlowState) => s.amount;
export const selectNote = (s: MoneriumFlowState) => s.note;
export const selectSelectedIbanOverride = (s: MoneriumFlowState) =>
    s.selectedIbanOverride;
