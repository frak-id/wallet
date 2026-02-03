/**
 * Zustand store for client ID management
 *
 * Stores the anonymous client ID received from the SDK (partner site localStorage).
 * Used for identity tracking in backend API calls via x-frak-client-id header.
 *
 * TODO: Evolve to Record<merchantId, clientId> for per-merchant clientId storage.
 * This will allow the wallet to track clientId usage across multiple merchants,
 * enabling client-side handling of token merging edge cases when backend
 * identity resolution misses some correlations.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClientIdStore } from "./types";

/**
 * Client ID store managing the current anonymous client identifier
 * Uses persist middleware to sync with localStorage
 */
export const clientIdStore = create<ClientIdStore>()(
    persist(
        (set) => ({
            // Initial state
            clientId: null,

            // Actions
            setClientId: (clientId) => set({ clientId }),
            clearClientId: () => set({ clientId: null }),
        }),
        {
            name: "frak_client_id_store",
            partialize: (state) => ({
                clientId: state.clientId,
            }),
        }
    )
);

/**
 * Selector functions for computed values
 */

// Get the current client ID
export const selectClientId = (state: ClientIdStore) => state.clientId;
