"use client";

import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { Provider } from "jotai";
import { type PropsWithChildren, useEffect } from "react";
import { openPanel } from "../utils/openPanel";

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
    useEffect(() => {
        if (!openPanel) return;
        openPanel.init();
    }, []);

    return (
        <Provider store={jotaiStore}>
            <PersistQueryClientProvider
                client={queryClient}
                persistOptions={persistOptions}
            >
                <FrakConfigProvider config={frakWalletSdkConfig}>
                    <FrakIFrameClientProvider>
                        <ReactQueryDevtools initialIsOpen={false} />
                        {children}
                    </FrakIFrameClientProvider>
                </FrakConfigProvider>
            </PersistQueryClientProvider>
        </Provider>
    );
}
