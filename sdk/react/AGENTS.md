# sdk/react — Compass

React bindings for `@frak-labs/core-sdk`. NPM only (no CDN). 10 public hooks, 2 providers. Peer deps: React 18+, TanStack Query 5+, Viem 2+.

## Key Files
- `src/hook/` — `useFrakClient`, `useFrakConfig`, `useWalletStatus`, `useDisplayModal`, `useSiweAuthenticate`, `useOpenSso`, `usePrepareSso`, `useSendTransactionAction`, `useGetMerchantInformation`, `useReferralInteraction`
- `src/provider/` — `FrakConfigProvider` (REQUIRED at app root), `FrakIFrameClientProvider`
- `src/index.ts` — barrel

## Hook Pattern
```ts
export function useWalletStatus(options?: UseQueryOptions) {
  const client = useFrakClient();
  return useQuery({
    queryKey: ["walletStatus"],
    queryFn: () => watchWalletStatus(client),
    ...options,
  });
}
```

## Non-Obvious Patterns
- **`FrakConfigProvider` is mandatory at root**; omitting it yields `useFrakClient is undefined` at runtime.
- **All hooks wrap core-sdk actions** — never re-implement logic here; delegate to `sdk/core`.
- **TanStack Query v5 API only** — do not mix with v4 patterns (`isLoading` vs `isPending`, etc.).
- **No CDN**: do not add IIFE/globalName config.
- **Test via `renderHook`** with `@frak-labs/test-foundation` `queryWrapper` fixture; mocks live there.

## See Also
Parent `sdk/AGENTS.md` · `sdk/core/AGENTS.md` (underlying actions) · `packages/test-foundation/AGENTS.md`.
