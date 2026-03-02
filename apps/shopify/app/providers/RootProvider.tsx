import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import {
    PersistQueryClientProvider,
    type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { type PropsWithChildren, useState } from "react";
import { ClientOnly } from "remix-utils/client-only";
import { FrakProvider } from "./FrakProvider";

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

export function RootProvider({ children }: PropsWithChildren) {
    /**
     * The query client that will be used by tanstack/react-query
     */
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        gcTime: Number.POSITIVE_INFINITY,
                        staleTime: 60 * 1000, // 1 minute
                    },
                },
            })
    );

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            <ClientOnly>
                {() => <FrakProvider>{children}</FrakProvider>}
            </ClientOnly>
        </PersistQueryClientProvider>
    );
}
