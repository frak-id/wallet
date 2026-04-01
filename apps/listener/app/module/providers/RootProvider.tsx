import {
    usePersistentPairingClient,
    WagmiProviderWithDynamicConfig,
} from "@frak-labs/wallet-shared";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
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

function PairingReconnect({ children }: PropsWithChildren) {
    usePersistentPairingClient();
    return children;
}

/**
 * Root provider for the listener app
 * Provides persisted QueryClient and Wagmi to the app
 */
export function RootProvider({ children }: PropsWithChildren) {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            <WagmiProviderWithDynamicConfig>
                <PairingReconnect>{children}</PairingReconnect>
            </WagmiProviderWithDynamicConfig>
        </PersistQueryClientProvider>
    );
}
