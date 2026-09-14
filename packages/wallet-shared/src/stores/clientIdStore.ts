/**
 * Anonymous client ID received from the SDK (partner-site localStorage),
 * sent on backend calls as `x-frak-client-id`.
 *
 * TODO: evolve to `Record<merchantId, clientId>` so multi-merchant token
 * merges can be resolved client-side.
 */

import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { ClientIdStore } from "./types";

export const clientIdStore = createStore<ClientIdStore>()(
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
