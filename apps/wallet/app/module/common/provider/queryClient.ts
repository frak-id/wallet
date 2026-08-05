import { QueryClient } from "@tanstack/react-query";

/**
 * The query client that will be used by tanstack/react-query.
 *
 * Lives in its own module rather than in `RootProvider` so that `main.tsx` can
 * hand this exact instance to the router context without pulling the whole
 * provider (and with it wagmi, the persister and the devtools) into the entry
 * module's import graph.
 *
 * Building a second client for the router would silently split the cache and
 * make every loader prefetch a no-op for the components.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: Number.POSITIVE_INFINITY,
            staleTime: 60 * 1000, // 1 minute
            // Prefetch in render — gone upstream in 5.102.2, hence the exact 5.101.4 catalog pin.
            experimental_prefetchInRender: true,
        },
    },
});
