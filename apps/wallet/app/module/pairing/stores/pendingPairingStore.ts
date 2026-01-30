/**
 * Zustand store for pending pairing parameters
 * Ephemeral store - no persistence, cleared on app restart
 */

import { create } from "zustand";

export type PendingPairingState = {
    pendingPairing: { id: string; code: string } | null;
    setPendingPairing: (params: { id: string; code: string }) => void;
    clearPendingPairing: () => void;
};

/**
 * Pending pairing store managing ephemeral pairing parameters
 * Does not persist - pairing params are cleared on app restart
 */
export const pendingPairingStore = create<PendingPairingState>((set) => ({
    // Initial state
    pendingPairing: null,

    // Actions
    setPendingPairing: (params) => set({ pendingPairing: params }),
    clearPendingPairing: () => set({ pendingPairing: null }),
}));
