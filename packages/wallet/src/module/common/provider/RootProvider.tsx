"use client";

import { rpcTransport } from "@/context/common/blockchain/provider";
import { ClientOnly } from "@/module/common/component/ClientOnly";
import { PaywallProvider } from "@/module/paywall/provider";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import type { PropsWithChildren } from "react";
import { polygonMumbai } from "viem/chains";
import { WagmiProvider, createConfig } from "wagmi";

// The query client that will be used by tanstack/react-query
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: Number.POSITIVE_INFINITY,
            staleTime: 60 * 1000, // 1 minute
        },
    },
});

// The wagmi config
const wagmiConfig = createConfig({
    chains: [polygonMumbai],
    transports: {
        [polygonMumbai.id]: rpcTransport,
    },
});

/**
 * The storage persister to cache our query data's
 */
const persister = createSyncStoragePersister({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    // Throttle for 50ms to prevent storage spamming
    throttleTime: 50,
});

const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
    persister,
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
