---
name: sdk-merchant-config
description: Model-check the web SDK's merchant config lifecycle (sdk/core sdkConfigStore.ts, loadCachedConfig.ts, setupClient.ts, and postConnectionSetup / sendLifecycleConfig / destroy in createIFrameFrakClient.ts, against the listener's last-write-wins handleResolvedConfig) with TLA+/TLC over every ordering of cache state, /user/merchant/resolve success or failure, iframe connect, sends, RPC requests, destroy and reloads. Use before merging any change to those files, including fixes for FRA-444, to show the listener always gets a context, never ends on a stale config, never loses trust it had, and the localStorage cache holds only backend config.
---

# Web SDK merchant config model

Every merchant page runs this code on every load. A wrong ordering here leaves the listener without the merchant (requests hang), with an old config, or in display-only mode with interactions disabled. And because the config is cached in `localStorage`, a bad value can stick around for later loads too. Tests cover the orderings someone wrote down. This model covers every ordering of the steps below, within the bounds in `model/MerchantConfig.cfg`.

## The rules

| Rule | Sentence | Harm when broken | Status at sync commit |
| --- | --- | --- | --- |
| `ListenerEndsOnLatest` | Once setup is done and every send has landed, the listener holds the same config as `window.__frakSdkConfig`. | The listener keeps the stale cached config after a fresh one arrived. | holds |
| `ContextAlwaysArrives` | Once setup is done on a connected client, `contextSent` has resolved. | Every RPC request waits on `contextSent` forever. | holds |
| `NoRequestBeforeContext` | No RPC request reaches the listener before a `resolved-config`. | The listener rejects it with "No resolving context available". | holds |
| `NoTrustDowngrade` | Within one page, once the listener holds a backend config, it never receives a non-backend one. | The listener drops from `verified` to `dev-override` or `unverified`, so interactions and merges are disabled. | **breaks** (FRA-444) |
| `CacheOnlyBackend` | The `localStorage` cache only ever holds a config built from a `/user/merchant/resolve` response. | A fallback with no merchant and no `allowedDomains` is cached. The next load within 30 s sends only that, with no fetch, so the listener is unverified even though the backend is up. | **breaks** (FRA-444) |
| `NoWriteAfterDestroy` | After `client.destroy()`, that client never writes the store or the cache again. | A late fetch undoes `clearCache()` / `reset()`: the cache and `window.__frakSdkConfig` are back after the merchant tore the client down. | **breaks** (finding 3) |

`model/expected.json` holds the status column. The check fails when a rule's result differs from it, in either direction.

## Run it

```sh
bun .pi/skills/sdk-merchant-config/scripts/check.ts             # the rules, ~25 s
bun .pi/skills/sdk-merchant-config/scripts/check.ts --mutants   # proof each check can fail, and the fix candidates, ~1 min
```

Both commands go through the shared runner `.pi/tla/check.ts`, which `native-event-outbox` also uses. It needs Java 11+ on `PATH`. On the first run it downloads TLC 1.7.4 to `~/.cache/frak-tla/` and checks its sha256. Add `--out <dir>` to keep TLC's output. Exit 0 means every rule matched `expected.json`.

Each broken rule prints its shortest path as numbered steps with the variables that changed. Read it, and every result, with the `/statechart` skill. It ships with the pstack plugin (`michael-denyer/pstack-claude`), not with this repo, so skip this step if you do not have it. It tells a violation as a path in plain words and, when the model passes, draws how the page moves between states. Give it `model/MerchantConfig.tla` and a config with the rule as an `INVARIANT`.

## Does my change touch the verified code?

Coverage, confirmed against the code at **sync commit `02ef48716`** (origin/dev, 2026-11-26):

| Model action | Code |
| --- | --- |
| `Create` | `setupClient` → `loadCachedConfig` (`setCacheScope`, `reset`: publishes the cache whatever its age), then `createIFrameFrakClient`'s `isCacheFresh ? undefined : resolve(...)` |
| `FetchOk`, `FetchFail` | `sdkConfigStore.resolve` → `fetchFromBackend`; any failure becomes `undefined` |
| `Connect` | `postConnectionSetup` after `await lifecycleManager.isConnected`: the cached send when `sdkConfigStore.isResolved` |
| `Merge` | `await configPromise`, `mergeAndSetConfig` (`setConfig`: global, `writeCache` when `isResolved`, which is always true here), then the fresh send |
| `Post`, `PostAt` | `sendChain` in `sendLifecycleConfig`, `.then(contextSent.resolve)` for the two setup sends, and the listener's `handleResolvedConfig` (synchronous up to `setContext`, so one message is one atomic apply) |
| `Request` | the `onRequest` middleware in `createIFrameFrakClient` (connected, then `await contextSent.promise`) |
| `Repush` | `setupProofFreshnessRepush`, installed after setup and stopped by `destroy` |
| `DestroyFull`, `DestroyDetach` | `destroy()`: `rpcClient.cleanup()`; the full form also runs `clearCache()` then `reset()` |
| `CacheAges`, `Reload` | `CACHE_TTL` (30 s); a navigation, which keeps `localStorage` and drops everything else |

```sh
git log --oneline 02ef48716..HEAD -- \
  sdk/core/src/config/sdkConfigStore.ts \
  sdk/core/src/config/loadCachedConfig.ts \
  sdk/core/src/clients/setupClient.ts \
  sdk/core/src/clients/createIFrameFrakClient.ts \
  apps/listener/app/module/handlers/lifecycleHandler.ts
```

Any commit listed there, or your own diff on those files, needs a look. Your change matters to the model if it changes:

- when the cache is read, trusted as fresh, written or cleared;
- when the fetch starts, or what a failed fetch produces;
- which configs `postConnectionSetup` sends, in what order, and which sends resolve `contextSent`;
- whether `handleResolvedConfig` awaits anything before `setContext`;
- what `destroy` stops.

CSS, i18n, backup pushes, proofs' contents and OpenPanel properties do not matter to it.

**Pending:** `perf/fra-435-nonblocking-config-fetch` (FRA-435, not merged at the sync commit) changes `postConnectionSetup` so it no longer awaits `configPromise` once the cached config was sent. When it lands, update `Connect` and `Merge` to match and rerun.

## When the check fails

1. **Your change was meant to change behavior.** Edit the action that stands for the code you changed. Rerun. If a rule now breaks, that is the change's effect, not a modeling detail.
2. **A rule breaks that should hold.** Replay the path against the real code before you believe it. The quickest replay is a Vitest file in `sdk/core/src/clients/` that mocks only `@frak-labs/frame-connector`'s `createRpcClient`, `./transports/iframeLifecycleManager`, `../config/clientId`, `../identity/sign`, `./ssoUrlListener` and `@openpanel/web`. Keep the real `sdkConfigStore` and `localStorage`, and stub `fetch` with `vi.stubGlobal`. The existing `createIFrameFrakClient.test.ts` mocks the store, so it cannot replay cache paths. Run it with `bunx vitest run <file>` from `sdk/core`. All three findings below were replayed this way.
   - **It reproduces:** it is a bug. Report the path in code words. Do not weaken the rule or narrow the model to make it pass.
   - **It does not reproduce:** the model is wrong. Find the action that allows a step the code forbids, fix it, and check it against the table above.
3. **A known finding now holds.** Someone fixed it. Confirm the fix in the code, set its rule to `holds` in `expected.json`, and update the status column above.
4. **A mutant reports `FAIL`.** Either its `find` text no longer matches the spec (the script says so), or the model lost the ability to catch that bug. Update `model/mutants.json`.

Once the model describes the code at a new commit, update the sync commit above and in the `git log` command. Do this only after you have checked each action in the coverage table against that commit.

## Findings at the sync commit

All three were reproduced on the real TypeScript, and the SDK code was left unchanged.

1. **`NoTrustDowngrade` (FRA-444).** A page loads with a stale cache, so it fetches. The fetch fails. The cached backend config is sent first, then `mergeAndSetConfig(undefined)` sends a fallback with `merchantId: ""` and `allowedDomains: []`, and the listener applies it last. Replayed: the listener received `["m-1", ["merchant.example.com"]]` then `["", []]`.
2. **`CacheOnlyBackend` (FRA-444).** A page with no cache fetches, and the fetch fails. The fallback is written to `localStorage` with `isResolved: true`. The next load within 30 s finds a fresh cache and sends only that fallback, with no fetch. Replayed: the cache held `{"isResolved":true,"merchantId":"","allowedDomains":[],...}`.
3. **`NoWriteAfterDestroy`.** The client connects with a fetch in flight. `destroy()` runs `clearCache()` and `reset()`. When the fetch answers, `postConnectionSetup` still calls `mergeAndSetConfig`, which rewrites the cache and `window.__frakSdkConfig` and dispatches `frak:config`. Replayed: the cache was empty after `destroy()`, then held the merchant again. The harm is small today, since it writes the right merchant back. It matters when a destroy is meant to clear state, or when the next client uses another cache scope, for example another `lang`.

The mutants also check fixes:
- **`naive-fra-444-fix`:** skipping the fallback entirely stops the downgrade, but a page with no cache and a failed fetch then never gets a context (`ContextAlwaysArrives` breaks).
- **`fra-444-candidate-fix`:** FRA-444's own candidate (skip only when the cache was sent) still caches the fallback (`CacheOnlyBackend` breaks).
- **`fra-444-full-fix`:** the candidate plus never writing the fallback to the cache. Every rule holds.

## What the model leaves out

- **Bounds:** 3 reloads, 3 successful fetches, 2 proof repushes, one client per page. A pass covers these bounds.
- **Assumptions:** the page origin is in the backend's `allowedDomains`, so a backend config means `verified`. Configs are compared by kind and version, not by field.
- **Not modelled:**
  - two clients alive on one page (React provider remount, `createIframe` replacing an iframe, a second `setupClient` with another `lang`), so a cache-scope change under a live client is not covered;
  - other tabs writing the same `localStorage` key, and `memoryEntry` going stale against them;
  - `withCache`'s dedupe and backoff;
  - the handshake deadline and `waitForConnection` timing out;
  - the merge token and SSO;
  - the listener's own store persistence.
