import { create } from "zustand";

/**
 * Transfer sub-flow screens. Setup screens are derived from the status
 * query and never stored.
 */
type MoneriumTransferScreen =
    | "transfer-amount"
    | "transfer-recap"
    | "transfer-iban";

type MoneriumFlowState = {
    screen: MoneriumTransferScreen;

    amount: string;
    note: string;
    orderId: string | null;
    /** What `orderId` was minted for: a retry of the same intent must not pay twice. */
    orderIntent: string | null;

    goTo: (screen: MoneriumTransferScreen) => void;
    setAmount: (amount: string) => void;
    setNote: (note: string) => void;
    /** The current order id while `intent` is unchanged, a fresh one otherwise. */
    orderIdFor: (intent: string) => string;
    forgetOrderId: () => void;
    /** Reset the transfer sub-flow (called on flow close). */
    resetTransfer: () => void;
};

const transferDefaults = {
    screen: "transfer-amount",
    amount: "",
    note: "",
    orderId: null,
    orderIntent: null,
} as const;

/** Not persisted: transfer form data resets on flow close. */
export const moneriumFlowStore = create<MoneriumFlowState>()((set, get) => ({
    ...transferDefaults,

    goTo: (screen) => set({ screen }),
    setAmount: (amount) => set({ amount }),
    setNote: (note) => set({ note }),
    orderIdFor: (intent) => {
        const { orderId, orderIntent } = get();
        if (orderId && orderIntent === intent) return orderId;
        const freshId = crypto.randomUUID();
        set({ orderId: freshId, orderIntent: intent });
        return freshId;
    },
    forgetOrderId: () => set({ orderId: null, orderIntent: null }),
    resetTransfer: () => set({ ...transferDefaults }),
}));

export const selectScreen = (s: MoneriumFlowState) => s.screen;
export const selectAmount = (s: MoneriumFlowState) => s.amount;
export const selectNote = (s: MoneriumFlowState) => s.note;
