"use client";

import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import {
    NexusConfigProvider,
    NexusIFrameClientProvider,
} from "@frak-labs/nexus-sdk/react";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { Provider } from "jotai";
import type { PropsWithChildren } from "react";
import { jotaiStore } from "../atoms/store";

/**
 * The query client that will be used by tanstack/react-query
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: Number.POSITIVE_INFINITY,
            staleTime: 60 * 1000, // 1 minute
        },
    },
});

/**
 * The storage persister to cache our query data's
 */
const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
    persister: createSyncStoragePersister({
        storage:
            typeof window !== "undefined" ? window.localStorage : undefined,
        // Throttle for 50ms to prevent storage spamming
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

export function RootProvider({ children }: PropsWithChildren) {
    return (
        <Provider store={jotaiStore}>
            <PersistQueryClientProvider
                client={queryClient}
                persistOptions={persistOptions}
            >
                <NexusConfigProvider config={frakWalletSdkConfig}>
                    <NexusIFrameClientProvider>
                        <ReactQueryDevtools initialIsOpen={false} />
                        {children}
                    </NexusIFrameClientProvider>
                </NexusConfigProvider>
            </PersistQueryClientProvider>
        </Provider>
    );
}
