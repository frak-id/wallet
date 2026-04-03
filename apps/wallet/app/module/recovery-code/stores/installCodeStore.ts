import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Resolved install code data stored after a successful `/resolve` call.
 * Persisted so it survives navigation between `/recovery-code` → `/register`.
 */
type InstallCodeData = {
    code: string;
    merchantId: string;
    merchant: {
        name: string;
        domain: string;
    };
};

type InstallCodeState = {
    pendingCode: InstallCodeData | null;
};

type InstallCodeActions = {
    setPendingCode: (data: InstallCodeData) => void;
    reset: () => void;
};

type InstallCodeStore = InstallCodeState & InstallCodeActions;

const initialState: InstallCodeState = {
    pendingCode: null,
};

export const installCodeStore = create<InstallCodeStore>()(
    persist(
        (set) => ({
            ...initialState,

            setPendingCode: (data) => set({ pendingCode: data }),
            reset: () => set(initialState),
        }),
        {
            name: "frak_install_code_store",
            partialize: (state) => ({
                pendingCode: state.pendingCode,
            }),
        }
    )
);

/**
 * Selectors
 */
export const selectPendingCode = (state: InstallCodeStore) => state.pendingCode;
