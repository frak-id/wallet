/**
 * Zustand store for pairing management
 */

import { create } from "zustand";
import type { PairingStore } from "./types";

/**
 * Pairing store managing pending pairing state
 * In-memory only (not persisted)
 */
export const pairingStore = create<PairingStore>((set) => ({
    // Initial state
    pendingPairing: null,

    // Actions
    setPendingPairing: (pendingPairing) => set({ pendingPairing }),
    clearPairing: () => set({ pendingPairing: null }),
}));

/**
 * Selector functions for computed values
 */

// Get the pending pairing
export const selectPendingPairing = (state: PairingStore) =>
    state.pendingPairing;
