import {
    setProfileId,
    usePersistentPairingClient,
    WagmiProviderWithDynamicConfig,
} from "@frak-labs/wallet-shared";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { lazy, type PropsWithChildren, Suspense, useEffect } from "react";
import { useConnection } from "wagmi";
import { useEnforceWagmiConnection } from "@/module/common/hook/useEnforceWagmiConnection";
import { useWalletSessionGuard } from "@/module/common/hook/useWalletSessionGuard";
import { queryClient } from "@/module/common/provider/queryClient";

const ReactQueryDevtools = lazy(() =>
    import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
    }))
);

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
            {content}
            {import.meta.env.DEV && (
                // Own boundary: the nearest ancestor Suspense is the router's,
                // shared with the whole app, so an unwrapped lazy devtools
                // import gates first paint behind the pending UI in dev.
                <Suspense fallback={null}>
                    <ReactQueryDevtools
                        initialIsOpen={false}
                        buttonPosition={"bottom-left"}
                    />
                </Suspense>
            )}
        </PersistQueryClientProvider>
    );
}

function SessionStateManager() {
    useEnforceWagmiConnection();
    usePersistentPairingClient();
    useWalletSessionGuard();

    // Set the open panel profile id with the wagmi address
    const { address } = useConnection();
    useEffect(() => {
        setProfileId(address);
    }, [address]);

    return null;
}
