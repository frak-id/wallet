import type { RampOfframpSource } from "@frak-labs/wallet-shared";
import type { Hex } from "viem";
import { create } from "zustand";

export type RampFlowScreen = "amount" | "swap" | "widget" | "success";

export type RampSale = {
    id: string;
    fiatAmount: number;
    fiatCurrency: string;
};

type RampFlowState = {
    screen: RampFlowScreen;
    source: RampOfframpSource;
    /** Raw input, two decimals at most. */
    amount: string;
    /** USDC base units handed to the widget, set once the source is USDC. */
    usdcAmount: bigint | null;
    sale: RampSale | null;
    txHash: Hex | null;
};

type RampFlowActions = {
    setSource: (source: RampOfframpSource) => void;
    setAmount: (amount: string) => void;
    goTo: (screen: RampFlowScreen) => void;
    startWidget: (usdcAmount: bigint) => void;
    setSale: (sale: RampSale) => void;
    setTxHash: (txHash: Hex) => void;
    reset: () => void;
};

const initialState: RampFlowState = {
    screen: "amount",
    source: "eure",
    amount: "",
    usdcAmount: null,
    sale: null,
    txHash: null,
};

export const rampFlowStore = create<RampFlowState & RampFlowActions>()(
    (set) => ({
        ...initialState,
        setSource: (source) => set({ source, amount: "" }),
        setAmount: (amount) => set({ amount }),
        goTo: (screen) => set({ screen }),
        startWidget: (usdcAmount) => set({ usdcAmount, screen: "widget" }),
        setSale: (sale) => set({ sale }),
        setTxHash: (txHash) => set({ txHash }),
        reset: () => set(initialState),
    })
);

export const selectScreen = (s: RampFlowState) => s.screen;
export const selectSource = (s: RampFlowState) => s.source;
export const selectAmount = (s: RampFlowState) => s.amount;
export const selectUsdcAmount = (s: RampFlowState) => s.usdcAmount;
export const selectSale = (s: RampFlowState) => s.sale;
export const selectTxHash = (s: RampFlowState) => s.txHash;
