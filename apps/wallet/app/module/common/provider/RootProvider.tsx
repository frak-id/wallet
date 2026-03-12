import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import {
    setProfileId,
    usePersistentPairingClient,
    WagmiProviderWithDynamicConfig,
} from "@frak-labs/wallet-shared";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type PropsWithChildren, useEffect } from "react";
import { useAccount } from "wagmi";
import { PwaInstallProvider } from "@/module/common/context/PwaInstallContext";
import { useEnforceWagmiConnection } from "@/module/common/hook/useEnforceWagmiConnection";
import {
    NotificationProvider,
    useNotificationContext,
} from "@/module/notification/context/NotificationContext";
import { notificationKey } from "@/module/notification/queryKeys/notification";

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
    const isNativeApp = isTauri();

    const content = (
        <NotificationProvider>
            <SetupNotifications />
            <WagmiProviderWithDynamicConfig>
                <SessionStateManager />
                {children}
            </WagmiProviderWithDynamicConfig>
        </NotificationProvider>
    );

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            {/* Only provide PWA install context in web mode, not in Tauri */}
            {isNativeApp ? (
                content
            ) : (
                <PwaInstallProvider>{content}</PwaInstallProvider>
            )}
            <ReactQueryDevtools
                initialIsOpen={false}
                buttonPosition={"top-right"}
            />
        </PersistQueryClientProvider>
    );
}

function SetupNotifications() {
    const { adapter, setIsSubscribed, setIsInitialized } =
        useNotificationContext();
    const queryClient = useQueryClient();

    useEffect(() => {
        const setupNotifications = async () => {
            const result = await adapter.initialize();
            setIsSubscribed(result.isSubscribed);
            // Seed the query cache with the authoritative value from
            // initialize() BEFORE enabling the query. This prevents a
            // race where adapter.isSubscribed() (backend hasAny) resolves
            // before a fire-and-forget sync completes on web, flipping the
            // UI to "not subscribed" for users with a valid local sub.
            queryClient.setQueryData(
                notificationKey.push.tokenCount,
                result.isSubscribed
            );
            setIsInitialized(true);
        };

        setupNotifications();
    }, [adapter, setIsSubscribed, setIsInitialized, queryClient]);

    return null;
}

function SessionStateManager() {
    useEnforceWagmiConnection();
    usePersistentPairingClient();

    // Set the open panel profile id with the wagmi address
    const { address } = useAccount();
    useEffect(() => {
        setProfileId(address);
    }, [address]);

    return null;
}
