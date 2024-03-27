"use client";

import { ClientOnly } from "@/module/common/component/ClientOnly";
import { PaywallProvider } from "@/module/paywall/provider";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import type { PropsWithChildren } from "react";
import { http, createClient } from "viem";
import { arbitrumSepolia, optimismSepolia, polygonMumbai } from "viem/chains";
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
    chains: [polygonMumbai, arbitrumSepolia, optimismSepolia],
    client: ({ chain }) => {
        // TODO: Should create our map of chainId to paid RPC networks and add them as fallback
        // Find the default http transports
        const httpTransports = chain.rpcUrls.default.http;
        if (!httpTransports) {
            throw new Error(
                `Chain with id ${chain.id} does not have a default http transport`
            );
        }

        // Build the viem client
        return createClient({
            chain,
            transport: http(httpTransports[0], {
                retryCount: 5,
                retryDelay: 200,
                timeout: 20_000,
            }),
            cacheTime: 60_000,
            batch: {
                multicall: { wait: 200 },
            },
        });
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

// TODO: Include a small 'build with ZeroDev and Permissionless' on the bottom
export function RootProvider({ children }: PropsWithChildren) {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            <WagmiProvider config={wagmiConfig}>
                <ClientOnly>
                    <PaywallProvider>{children}</PaywallProvider>
                </ClientOnly>
            </WagmiProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </PersistQueryClientProvider>
    );
}
