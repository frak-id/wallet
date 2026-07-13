import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { useRouterState } from "@tanstack/react-router";
import { type PropsWithChildren, useEffect } from "react";
import { frakWalletSdkConfig } from "@/config/frakWallet";
import { TwoFactorModal } from "@/module/auth/component/TwoFactorModal";
import { openPanel } from "../utils/openPanel";
import { queryClient } from "./queryClient";

/**
 * Re-exported for use in TanStack Router loaders and existing importers.
 * @see ./queryClient
 */
export { queryClient };

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
                    <TwoFactorModal />
                </FrakIFrameClientProvider>
            </FrakConfigProvider>
        </PersistQueryClientProvider>
    );
}
