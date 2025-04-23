import { isRunningInProd } from "@frak-labs/app-essentials";
import { getTransport } from "@frak-labs/app-essentials/blockchain";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import type { PropsWithChildren } from "react";
import { createClient } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { WagmiProvider, createConfig } from "wagmi";

/**
 * The query client that will be used by tanstack/react-query
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: Number.POSITIVE_INFINITY,
            staleTime: 60 * 1000, // 1 minute
            // Enable prefetching during the page render, for snappier UI / data
            experimental_prefetchInRender: true,
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
    // Invalidate the cache when the app version changes
    buster: process.env.APP_VERSION,
};

const wagmiConfig = createConfig({
    chains: [isRunningInProd ? arbitrum : arbitrumSepolia],
    multiInjectedProviderDiscovery: false,
    client: ({ chain }) =>
        createClient({
            chain,
            transport: getTransport({ chain }),
            cacheTime: 60_000,
            batch: {
                multicall: {
                    wait: 50,
                },
            },
        }),
});

export function RootProvider({ children }: PropsWithChildren) {
    return (
        <>
            <PersistQueryClientProvider
                client={queryClient}
                persistOptions={persistOptions}
            >
                <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
                <ReactQueryDevtools
                    initialIsOpen={false}
                    buttonPosition={"top-right"}
                />
            </PersistQueryClientProvider>
        </>
    );
}
