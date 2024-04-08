"use client";

import {
    availableChains,
    getViemClientFromChain,
} from "@/context/common/blockchain/provider";
import { ThemeListener } from "@/module/settings/atoms/theme";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { Provider } from "jotai";
import type { PropsWithChildren } from "react";
import { WagmiProvider, createConfig } from "wagmi";

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
 * Our global wagmi config (define the possible chain and the client factory)
 */
const wagmiConfig = createConfig({
    chains: availableChains,
    client: ({ chain }) => getViemClientFromChain({ chain }),
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
        <>
            <Provider>
                <PersistQueryClientProvider
                    client={queryClient}
                    persistOptions={persistOptions}
                >
                    <WagmiProvider config={wagmiConfig}>
                        {children}
                    </WagmiProvider>
                    <ReactQueryDevtools initialIsOpen={false} />
                </PersistQueryClientProvider>
                <ThemeListener />
            </Provider>
        </>
    );
}
