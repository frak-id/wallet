/**
 * Typed identity helper for `@tanstack/query-core` query options.
 *
 * Mirrors the runtime behaviour of `queryOptions()` from
 * `@tanstack/react-query` (`(x) => x`) without statically importing the
 * React bindings. The listener iframe bootstrap (Ring 0) uses
 * `queryClient.fetchQuery(...)` from `@tanstack/query-core` for its RPC
 * handlers and must stay free of the lazy `@tanstack/react-query` chunk —
 * any cross-chunk static import pulls preact + i18next + react-query into
 * the eager bundle.
 *
 * Consumers that need React Query inference (`useQuery` / `useMutation`)
 * keep using the upstream `queryOptions` directly.
 */
export function queryOptions<const T>(options: T): T {
    return options;
}
