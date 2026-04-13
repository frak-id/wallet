import {
    setProfileId,
    usePersistentPairingClient,
    WagmiProviderWithDynamicConfig,
} from "@frak-labs/wallet-shared";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { lazy, type PropsWithChildren, useEffect } from "react";
import { useConnection } from "wagmi";
import { PwaInstallProvider } from "@/module/common/context/PwaInstallContext";
import { useEnforceWagmiConnection } from "@/module/common/hook/useEnforceWagmiConnection";

const ReactQueryDevtools = lazy(() =>
    import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
    }))
);

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
    persister: createAsyncStoragePersister({
        storage: window.localStorage,
        // Throttle for 50ms to prevent storage spamming
        throttleTime: 50,
    }),
    maxAge: Number.POSITIVE_INFINITY,
    dehydrateOptions: {
        shouldDehydrateQuery: ({ meta, state }) => {
            // Only dehydrate successful queries, exclude pending/error/paused
            const isSuccess = state.status === "success";
            const isStorable = (meta?.storable as boolean) ?? true;
            // Also ensure data exists to prevent hydration issues
            const hasData = state.data !== undefined;
            return isSuccess && isStorable && hasData;
        },
    },
    // Invalidate the cache when the app version changes
    buster: process.env.APP_VERSION,
};

export function RootProvider({ children }: PropsWithChildren) {
    const content = (
        <>
            <WagmiProviderWithDynamicConfig>
                <SessionStateManager />
                {children}
            </WagmiProviderWithDynamicConfig>
        </>
    );

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            {process.env.IS_TAURI ? (
                content
            ) : (
                <PwaInstallProvider>{content}</PwaInstallProvider>
            )}
            {import.meta.env.DEV && (
                <ReactQueryDevtools
                    initialIsOpen={false}
                    buttonPosition={"top-right"}
                />
            )}
        </PersistQueryClientProvider>
    );
}

function SessionStateManager() {
    useEnforceWagmiConnection();
    usePersistentPairingClient();

    // Set the open panel profile id with the wagmi address
    const { address } = useConnection();
    useEffect(() => {
        setProfileId(address);
    }, [address]);

    return null;
}
