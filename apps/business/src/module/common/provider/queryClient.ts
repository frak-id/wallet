import { QueryClient } from "@tanstack/react-query";

/**
 * The query client that will be used by tanstack/react-query.
 *
 * Kept in its own module (rather than alongside `RootProvider`) so it can be
 * imported from non-React code (`authStore`, Eden client) without pulling in
 * the whole provider tree — which would create an import cycle.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: Number.POSITIVE_INFINITY,
            staleTime: 60 * 1000, // 1 minute
        },
    },
});
