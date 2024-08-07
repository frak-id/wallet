"use client";

import { availableChains, getTransport } from "@/context/blockchain/provider";
import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { sessionAtom } from "@/module/common/atoms/session";
import { useEnforceWagmiConnection } from "@/module/common/hook/useEnforceWagmiConnection";
import { ThemeListener } from "@/module/settings/atoms/theme";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
import type { InteractionSession, Session } from "@/types/Session";
import { jotaiStore } from "@module/atoms/store";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { Provider } from "jotai/index";
import { RESET, useHydrateAtoms } from "jotai/utils";
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
    interactionSession,
    children,
}: PropsWithChildren<{
    session: Session | null;
    interactionSession: InteractionSession | null;
}>) {
    // Hydrate the session atoms
    useHydrateAtoms(
        [
            [sessionAtom, session ?? RESET],
            [interactionSessionAtom, interactionSession ?? RESET],
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
