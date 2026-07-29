---
"@frak-labs/core-sdk": minor
"@frak-labs/react-sdk": minor
"@frak-labs/components": patch
---

Every anonymous client id is now derived from a P-256 keypair and provable. The random, unprovable fallback id is gone.

**BREAKING** — three public signatures changed, because derivation is inherently async:

- `getClientId()` now returns `string | undefined` instead of `string`. It stays synchronous (it is exposed at runtime on `window.FrakSetup.core`, and consumers such as the Shopify cart-attribute snippet call it inside a sync function), but it returns `undefined` until derivation completes rather than minting an id on the spot. On a cold read it schedules derivation in the background so a later call succeeds.
- `createIFrameFrakClient()` now returns `Promise<FrakClient>`.
- `processReferral()` is now `async` and returns `Promise<ReferralState>`.

New `getClientIdAsync(): Promise<string>` awaits derivation, joining any in-flight work. **Prefer it everywhere an `await` is possible** — it is the only accessor that is correct on a cold cache. It needs no `setupClient` call. It rejects rather than resolving an unprovable id.

Also exported: `buildListenerUrl()`, so both iframe creators share one URL builder.

Other fixes:

- `FrakIFrameClientProvider` (React) never passed `clientId` to the listener iframe, so the listener silently fell back to its own persisted store instead of the SDK-seeded identity. It now seeds the URL via `buildListenerUrl`.
- `createIFrameFrakClient` resolves the anonymous id once, after the merchant-config fetch is already in flight, so derivation overlaps the network call rather than delaying it.
- The Shopify snippets listened for a `frakClientReady` event that was renamed to `frak:client` in `6e9006605`; both now listen for the current name.

Migration: replace `getClientId()` with `await getClientIdAsync()` wherever you can await. If you must stay synchronous, handle `undefined` — note that on a first-ever visit both `getClientId()` and `localStorage.getItem('frak-client-id')` are now empty until derivation finishes.
