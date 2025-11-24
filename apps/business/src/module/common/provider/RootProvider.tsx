import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { useRouterState } from "@tanstack/react-router";
import { type PropsWithChildren, useEffect } from "react";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { openPanel } from "../utils/openPanel";

/**
 * The query client that will be used by tanstack/react-query
 * Exported for use in TanStack Router loaders
 */
export const queryClient = new QueryClient({
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

/**
 * Client component that manages the data-page attribute on the root element
 * based on the current route
 */
function RoutePageAttribute() {
    const routerState = useRouterState({
        select: (state) => ({
            pathname: state.location.pathname,
            matches: state.matches,
        }),
    });

    useEffect(() => {
        if (typeof document === "undefined") return;

        const rootElement = document.documentElement;
        if (!rootElement) return;

        const isRestricted = routerState.matches.some(
            (match) => match.routeId === "/_restricted"
        );
        const isAuthentication =
            routerState.pathname === "/login" ||
            routerState.matches.some((match) => match.routeId === "/login");

        if (isRestricted) {
            rootElement.dataset.page = "restricted";
        } else if (isAuthentication) {
            rootElement.dataset.page = "authentication";
        } else {
            rootElement.removeAttribute("data-page");
        }
    }, [routerState.pathname, routerState.matches]);

    return null;
}

export function RootProvider({ children }: PropsWithChildren) {
    useEffect(() => {
        if (!openPanel) return;
        openPanel.init();
    }, []);

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            <FrakConfigProvider config={frakWalletSdkConfig}>
                <FrakIFrameClientProvider>
                    <RoutePageAttribute />
                    <ReactQueryDevtools initialIsOpen={false} />
                    {children}
                </FrakIFrameClientProvider>
            </FrakConfigProvider>
        </PersistQueryClientProvider>
    );
}
