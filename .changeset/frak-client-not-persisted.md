---
"@frak-labs/react-sdk": patch
---

Fix `client.request is not a function` in `FrakIFrameClientProvider` when the app persists its react-query cache.

The client is held in a `useQuery`, so a persister wrote it to storage. Serialising drops `request` and flattens the connection promises, and the infinite `staleTime` meant the dead object was never refetched — so every consumer (`useSiweAuthenticate`, `useOpenSso`, …) threw on the second page load. The query now opts out of persistence via `meta.storable`, the convention app-level `shouldDehydrateQuery` predicates already read. The listener URL stays persisted.
