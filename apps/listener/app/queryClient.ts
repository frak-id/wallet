/**
 * Vanilla `QueryClient` singleton shared between Ring 0 (RPC handlers,
 * bootstrap) and Ring 1 (the React provider tree).
 *
 * Importing `QueryClient` from `@tanstack/query-core` directly keeps the
 * eager bundle off `@tanstack/react-query` (which adds the React-bindings
 * + observers + ContextProvider). Ring 1 still uses `react-query` for the
 * provider, but it operates on the SAME instance exported here.
 *
 * Persistence (sessionStorage hydration + dehydration) is wired up
 * lazily: the first call to `ensureHydrated()` restores the cache from
 * `sessionStorage` and starts the dehydrate-on-update subscription.
 * Headless RPC handlers `await ensureHydrated()` before `fetchQuery` so
 * cached entries are available without a network round-trip.
 */

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/query-core";
import {
    type PersistQueryClientOptions,
    persistQueryClient,
} from "@tanstack/query-persist-client-core";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 5 * 60 * 1000, // 5 minutes
            staleTime: 60 * 1000, // 1 minute
            retry: 1, // Reduced retries for iframe context
        },
    },
});

const persister = createAsyncStoragePersister({
    storage: globalThis.sessionStorage,
    throttleTime: 50,
});

const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
    persister,
    maxAge: Number.POSITIVE_INFINITY,
    dehydrateOptions: {
        shouldDehydrateQuery: ({ meta, state }) => {
            const isValid = state.status === "success";
            const isStorable = (meta?.storable as boolean) ?? true;
            return isValid && isStorable;
        },
    },
};

let hydrationPromise: Promise<void> | null = null;

/**
 * Restore the QueryClient from sessionStorage and start the auto-save
 * subscription. Idempotent — subsequent calls return the same Promise so
 * concurrent handlers do not double-restore.
 *
 * Ring 1's `RootProvider` wraps the app in a plain `QueryClientProvider`
 * pointing at the same client; React consumers see whatever data
 * Ring 0 already restored.
 */
export function ensureHydrated(): Promise<void> {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
        // `persistQueryClient` returns a tuple [unsubscribe, restorePromise].
        // We only care about the restore here; the unsubscribe handle is held
        // for the lifetime of the iframe (which is the lifetime of the page).
        const [, restorePromise] = persistQueryClient({
            queryClient,
            ...persistOptions,
        });
        await restorePromise;
    })();
    return hydrationPromise;
}
