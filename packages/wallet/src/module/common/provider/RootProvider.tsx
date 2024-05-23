"use client";

import { availableChains, getTransport } from "@/context/blockchain/provider";
import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { sessionAtom } from "@/module/common/atoms/session";
import { jotaiStore } from "@/module/common/atoms/store";
import { useEnforceWagmiConnection } from "@/module/common/hook/useEnforceWagmiConnection";
import { userAtom } from "@/module/membrs/atoms/user";
import { ThemeListener } from "@/module/settings/atoms/theme";
import type { Session } from "@/types/Session";
import type { User } from "@/types/User";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { Provider } from "jotai/index";
import { useHydrateAtoms } from "jotai/utils";
import { type PropsWithChildren, useMemo } from "react";
import { createClient } from "viem";
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

export function RootProvider({
    session,
    user,
    children,
}: PropsWithChildren<{ session: Session | null; user: User | null }>) {
    // Hydrate the session atoms
    useHydrateAtoms(
        [
            [sessionAtom, session],
            [userAtom, user],
        ],
        {
            store: jotaiStore,
        }
    );

    return (
        <>
            <Provider store={jotaiStore}>
                <PersistQueryClientProvider
                    client={queryClient}
                    persistOptions={persistOptions}
                >
                    <WagmiProviderWithDynamicConfig>
                        {children}
                    </WagmiProviderWithDynamicConfig>
                    <ReactQueryDevtools initialIsOpen={false} />
                </PersistQueryClientProvider>
                <ThemeListener />
            </Provider>
        </>
    );
}

function WagmiProviderWithDynamicConfig({ children }: PropsWithChildren) {
    const config = useMemo(
        () =>
            createConfig({
                chains: availableChains,
                connectors: [smartAccountConnector()],
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
            }),
        []
    );
    return (
        <WagmiProvider config={config}>
            <EnforceWagmiConnection />
            {children}
        </WagmiProvider>
    );
}

function EnforceWagmiConnection() {
    useEnforceWagmiConnection();
    return null;
}
