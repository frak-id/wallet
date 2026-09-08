import {
    FrakConfigProvider,
    FrakIFrameClientProvider,
} from "@frak-labs/react-sdk";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { useRouterState } from "@tanstack/react-router";
import { lazy, type PropsWithChildren, Suspense, useEffect } from "react";
import { frakWalletSdkConfig } from "@/config/frakWallet";
import { TwoFactorModal } from "@/module/auth/component/TwoFactorModal";
import { openPanel } from "../utils/openPanel";
import { queryClient } from "./queryClient";

// Lazy + DEV-gated. A static import defeats the render-site guard: the
// namespace re-export inside @tanstack/react-query-devtools keeps its own
// `NODE_ENV` check from being tree-shaken, so the whole panel ships eagerly
// (~18.6 KB gz) once the component is merely referenced. Mirrors apps/wallet.
const ReactQueryDevtools = lazy(() =>
    import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
    }))
);

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
                    {import.meta.env.DEV && (
                        // Own boundary: the nearest ancestor Suspense is the
                        // router's, shared with the whole app, so an unwrapped
                        // lazy devtools import gates first paint behind
                        // PendingLoader in dev.
                        <Suspense fallback={null}>
                            <ReactQueryDevtools initialIsOpen={false} />
                        </Suspense>
                    )}
                    {children}
                    <TwoFactorModal />
                </FrakIFrameClientProvider>
            </FrakConfigProvider>
        </PersistQueryClientProvider>
    );
}
