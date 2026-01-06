import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import {
    authenticatedWalletApi,
    setProfileId,
    usePersistentPairingClient,
    WagmiProviderWithDynamicConfig,
} from "@frak-labs/wallet-shared";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
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
            {/* Only setup service worker in web mode, not in Tauri */}
            {!isNativeApp && <SetupServiceWorker />}
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

/**
 * Setup the service worker for push notifications
 * @constructor
 */
function SetupServiceWorker() {
    const { setSubscription } = useNotificationContext();

    // Hook to automatically register the service worker if possible
    useEffect(() => {
        // Early exit if not supported
        if (
            typeof navigator === "undefined" ||
            !("serviceWorker" in navigator)
        ) {
            return;
        }

        const loadServiceWorker = async () => {
            // Ask the navigator to register the service worker
            const registration = await navigator.serviceWorker.register(
                "/sw.js",
                {
                    scope: "/",
                    updateViaCache: "none",
                }
            );
            // Get potential subscription already present in the service worker
            const subscription =
                "pushManager" in registration
                    ? await registration.pushManager.getSubscription()
                    : undefined;
            if (!subscription) {
                console.log(
                    "No previous subscription found on this service worker"
                );
                return;
            }
            setSubscription(subscription);

            // Save this new subscription
            const jsonSubscription = subscription.toJSON();
            await authenticatedWalletApi.notifications.tokens.put({
                subscription: {
                    endpoint: jsonSubscription.endpoint ?? "no-endpoint",
                    keys: {
                        p256dh: jsonSubscription.keys?.p256dh ?? "no-p256",
                        auth: jsonSubscription.keys?.auth ?? "no-auth",
                    },
                    expirationTime:
                        jsonSubscription.expirationTime ?? undefined,
                },
            });
        };

        loadServiceWorker();
    }, [setSubscription]);

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
