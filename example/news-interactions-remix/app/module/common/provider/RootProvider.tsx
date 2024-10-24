import {
    NexusConfigProvider,
    NexusIFrameClientProvider,
} from "@frak-labs/nexus-sdk/react";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { type PropsWithChildren, useState } from "react";
import { useDehydratedState } from "use-dehydrated-state";

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

const frakWalletSdkConfig = {
    walletUrl: process.env.FRAK_WALLET_URL as string,
    metadata: {
        name: "Good Vibes",
    },
    // Specify domain for valid test on localhost
    domain: "news-paper.xyz",
};

export function RootProvider({ children }: PropsWithChildren) {
    /**
     * The query client that will be used by tanstack/react-query
     */
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        gcTime: Number.POSITIVE_INFINITY,
                        staleTime: 60 * 1000, // 1 minute
                    },
                },
            })
    );
    const dehydratedState = useDehydratedState();
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            <HydrationBoundary state={dehydratedState}>
                <NexusConfigProvider config={frakWalletSdkConfig}>
                    <NexusIFrameClientProvider>
                        <ReactQueryDevtools initialIsOpen={false} />
                        {children}
                    </NexusIFrameClientProvider>
                </NexusConfigProvider>
            </HydrationBoundary>
        </PersistQueryClientProvider>
    );
}
