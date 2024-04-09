"use client";

import { wagmiConfigAtom } from "@/module/common/atoms/wagmi";
import { HydrateAtoms } from "@/module/common/component/HydrateAtoms";
import { ThemeListener } from "@/module/settings/atoms/theme";
import type { Session } from "@/types/Session";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { Provider } from "jotai";
import { useAtomValue } from "jotai/index";
import type { PropsWithChildren } from "react";
import { WagmiProvider } from "wagmi";

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
    children,
}: PropsWithChildren<{ session: Session | null }>) {
    return (
        <>
            <Provider>
                <HydrateAtoms session={session}>
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
                </HydrateAtoms>
            </Provider>
        </>
    );
}

function WagmiProviderWithDynamicConfig({ children }: PropsWithChildren) {
    const config = useAtomValue(wagmiConfigAtom);
    return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
