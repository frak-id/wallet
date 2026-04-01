import {
    clientIdStore,
    updateGlobalProperties,
} from "@frak-labs/wallet-shared";
import { create } from "zustand";
import type { ResolvingContextStore, TrustLevel } from "./types";

/**
 * Read clientId from iframe URL query param (set by SDK at iframe creation).
 * Available from the very first line of code — no round-trip needed.
 */
const iframeParams =
    typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : undefined;
const iframeClientId = iframeParams?.get("clientId") ?? undefined;

// Set clientId in store immediately at module load — before any async work.
// This ensures the x-frak-client-id header is available for the earliest API calls.
// Also re-set after persist rehydration to prevent stale localStorage values from
// overwriting the fresh URL param (race: sync setClientId vs async rehydration).
if (iframeClientId) {
    clientIdStore.getState().setClientId(iframeClientId);
    clientIdStore.persist.onFinishHydration(() => {
        clientIdStore.getState().setClientId(iframeClientId);
    });
}

export { iframeClientId };

export const resolvingContextStore = create<ResolvingContextStore>((set) => ({
    context: undefined,
    backendSdkConfig: undefined,
    trustLevel: "pending" as TrustLevel,

    setContext: (context) => {
        set({ context });
        updateGlobalProperties({
            isIframe: true,
            contextUrl: context.sourceUrl,
        });
    },

    clearContext: () =>
        set({
            context: undefined,
            backendSdkConfig: undefined,
            trustLevel: "pending" as TrustLevel,
        }),

    setTrustLevel: (level: TrustLevel) => set({ trustLevel: level }),

    setBackendConfig: (merchantId, config) => {
        set((state) => ({
            backendSdkConfig: config,
            context: state.context
                ? {
                      ...state.context,
                      merchantId: merchantId || state.context.merchantId,
                  }
                : state.context,
        }));
    },
}));
