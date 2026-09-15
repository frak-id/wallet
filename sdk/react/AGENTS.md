# sdk/react — Compass

React bindings for `@frak-labs/core-sdk`. NPM only (no CDN). Peer deps: React 18+, TanStack Query 5+, Viem 2+.

## Key Files
- `src/hook/` — one hook per core action; `src/hook/index.ts` is the list
- `src/provider/` — `FrakConfigProvider` (REQUIRED at app root), `FrakIFrameClientProvider`
- `src/index.ts` — barrel

## Hook Pattern
Query hooks take a `{ query }` bag, mutation hooks a `{ mutations }` one, and
both throw `ClientNotFound` rather than running without a client:
```ts
export function useGetMerchantInformation({ query }: UseGetMerchantInformationParams = {}) {
  const client = useFrakClient();
  return useQuery({
    ...query,
    queryKey: ["frak-sdk", "get-merchant-information"],
    queryFn: async () => {
      if (!client) throw new ClientNotFound();
      return getMerchantInformation(client);
    },
  });
}
```

## Non-Obvious Patterns
- **`FrakConfigProvider` is mandatory at root**; omitting it yields `useFrakClient is undefined` at runtime.
- **All hooks wrap core-sdk actions** — never re-implement logic here; delegate to `sdk/core`.
- **TanStack Query v5 API only** — do not mix with v4 patterns (`isLoading` vs `isPending`, etc.).
- **No CDN**: do not add IIFE/globalName config.
- **Test via `renderHook`** with the `queryWrapper` / `mockFrakProviders` fixtures from `tests/vitest-fixtures.ts` (which extends `@frak-labs/wallet-shared`'s).

## See Also
Parent `sdk/AGENTS.md` · `sdk/core/AGENTS.md` (underlying actions) · `packages/test-foundation/AGENTS.md`.
