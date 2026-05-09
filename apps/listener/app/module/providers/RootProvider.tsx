import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import type { PropsWithChildren } from "react";

/**
 * The query client for TanStack Query
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 5 * 60 * 1000, // 5 minutes
            staleTime: 60 * 1000, // 1 minute
            retry: 1, // Reduced retries for iframe context
        },
    },
});

const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
    persister: createAsyncStoragePersister({
        storage: globalThis.sessionStorage,
        throttleTime: 50,
    }),
    maxAge: Number.POSITIVE_INFINITY,
    dehydrateOptions: {
        shouldDehydrateQuery: ({ meta, state }) => {
            const isValid = state.status === "success";
            const isStorable = (meta?.storable as boolean) ?? true;
            return isValid && isStorable;
        },
    },
};

/**
 * Root provider for the listener app
 * Provides persisted QueryClient to the app.
 *
 * Note: `WagmiProviderWithDynamicConfig` is intentionally NOT mounted here.
 * It is moved into the lazy-loaded modal + embedded-wallet boundaries via
 * `BlockchainProvider`, so the wagmi/viem/permissionless graph stays out of
 * the eager iframe bundle.
 *
 * Note: `usePersistentPairingClient` is also NOT mounted here. Pairing is
 * only consumed by the Modal + Embedded Wallet UI trees (signature requests,
 * smart-wallet ops). Mounting it inside those trees instead of eagerly here
 * keeps the WebSocket dormant until a partner site triggers UI — reducing
 * idle backend WS load.
 */
export function RootProvider({ children }: PropsWithChildren) {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
