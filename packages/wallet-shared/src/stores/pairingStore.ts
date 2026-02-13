/**
 * Zustand store for short-lived pairing intent
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PairingStore } from "./types";

const PENDING_PAIRING_TTL_MS = 5 * 60 * 1000;

const sessionStorageStorage =
    typeof window === "undefined"
        ? undefined
        : createJSONStorage(() => sessionStorage);

/**
 * Pairing store managing the pending pairing ID within a short-lived session
 * Uses persist middleware to sync with sessionStorage
 */
export const pairingStore = create<PairingStore>()(
    persist(
        (set) => ({
            // Initial state
            pendingPairingId: null,
            pendingPairingExpiresAt: null,

            // Actions
            setPendingPairingId: (pendingPairingId) =>
                set({
                    pendingPairingId,
                    pendingPairingExpiresAt:
                        Date.now() + PENDING_PAIRING_TTL_MS,
                }),
            clearPendingPairing: () =>
                set({
                    pendingPairingId: null,
                    pendingPairingExpiresAt: null,
                }),
        }),
        {
            name: "frak_pairing_store",
            storage: sessionStorageStorage,
            partialize: (state) => ({
                pendingPairingId: state.pendingPairingId,
                pendingPairingExpiresAt: state.pendingPairingExpiresAt,
            }),
        }
    )
);

/**
 * Selector functions for computed values
 */

export const selectPendingPairingId = (state: PairingStore) =>
    state.pendingPairingId;

export const selectPendingPairingExpiresAt = (state: PairingStore) =>
    state.pendingPairingExpiresAt;

export const getValidPendingPairingId = () => {
    const { pendingPairingId, pendingPairingExpiresAt, clearPendingPairing } =
        pairingStore.getState();

    if (!pendingPairingId || !pendingPairingExpiresAt) {
        return null;
    }

    if (pendingPairingExpiresAt <= Date.now()) {
        clearPendingPairing();
        return null;
    }

    return pendingPairingId;
};
