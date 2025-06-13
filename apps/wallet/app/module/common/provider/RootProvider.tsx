import { currentChain } from "@/module/blockchain/provider";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { useEnforceWagmiConnection } from "@/module/common/hook/useEnforceWagmiConnection";
import { subscriptionAtom } from "@/module/notification/atom/subscriptionAtom";
import { smartAccountConnector } from "@/module/wallet/smartWallet/connector";
import { getTransport } from "@frak-labs/app-essentials/blockchain";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistQueryClientProviderProps } from "@tanstack/react-query-persist-client";
import { Provider } from "jotai";
import { type PropsWithChildren, useEffect, useMemo } from "react";
import { createClient } from "viem";
import { WagmiProvider, createConfig, useAccount } from "wagmi";
import { usePersistentPairingClient } from "../../pairing/hook/usePersistentPairingClient";
import { openPanel } from "../analytics";

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
            const isValid = state.status === "success";
            const isStorable = (meta?.storable as boolean) ?? true;
            return isValid && isStorable;
        },
    },
    // Invalidate the cache when the app version changes
    buster: process.env.APP_VERSION,
};

export function RootProvider({ children }: PropsWithChildren) {
    return (
        <>
            <Provider store={jotaiStore}>
                <PersistQueryClientProvider
                    client={queryClient}
                    persistOptions={persistOptions}
                >
                    <SetupServiceWorker />
                    <WagmiProviderWithDynamicConfig>
                        {children}
                    </WagmiProviderWithDynamicConfig>
                    <ReactQueryDevtools
                        initialIsOpen={false}
                        buttonPosition={"top-right"}
                    />
                </PersistQueryClientProvider>
            </Provider>
        </>
    );
}

/**
 * Setup the service worker for push notifications
 * @constructor
 */
function SetupServiceWorker() {
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
            jotaiStore.set(subscriptionAtom, subscription);

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
    }, []);

    return null;
}

function WagmiProviderWithDynamicConfig({ children }: PropsWithChildren) {
    const config = useMemo(
        () =>
            createConfig({
                chains: [currentChain],
                connectors: [smartAccountConnector()],
                multiInjectedProviderDiscovery: false,
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
            <SessionStateManager />
            {children}
        </WagmiProvider>
    );
}

function SessionStateManager() {
    useEnforceWagmiConnection();
    usePersistentPairingClient();

    // Set the open panel profile id with the wagmi address
    const { address } = useAccount();
    useEffect(() => {
        if (!openPanel) return;
        openPanel.profileId = address;
    }, [address]);

    return null;
}
