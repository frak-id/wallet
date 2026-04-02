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
    clearPendingCode: () => void;
};

export const installCodeStore = create<InstallCodeState & InstallCodeActions>()(
    persist(
        (set) => ({
            pendingCode: null,
            setPendingCode: (data) => set({ pendingCode: data }),
            clearPendingCode: () => set({ pendingCode: null }),
        }),
        {
            name: "frak_install_code_store",
            partialize: (state) => ({ pendingCode: state.pendingCode }),
        }
    )
);
