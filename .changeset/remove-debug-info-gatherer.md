---
"@frak-labs/core-sdk": minor
"@frak-labs/components": patch
---

Remove the unused `DebugInfoGatherer` class from `@frak-labs/core-sdk`. The class was constructed once per `createIFrameFrakClient` call and its state was actively maintained on every RPC roundtrip via middleware (`setLastRequest` / `setLastResponse` / `updateSetupStatus`), but its single output method `client.debugInfo.formatDebugInfo()` was never called anywhere — zero consumers in `apps/`, `packages/`, sister `sdk/` packages, `example/`, `services/`, or `plugins/`. The only non-definition reference was a `vi.fn()` mock in `sdk/components/tests/vitest-setup.ts` to satisfy the `FrakClient` type shape.

**Public API change**: `DebugInfoGatherer` is no longer exported from `@frak-labs/core-sdk`. The `debugInfo` field on `FrakClient` is removed. External consumers calling `client.debugInfo.formatDebugInfo()` would need to handle errors via their own error-reporting infrastructure (e.g. wrapping `client.request(...)` calls in try/catch and reporting via the merchant's existing observability stack).

If SDK-side observability is desired in the future, the natural path is a typed `sdk_rpc_error` event emitted via the already-initialized `client.openPanel?.track(...)` (mirroring the `recordError` / `app_error` pattern in `packages/wallet-shared`). That would be a new feature, built fresh — not a revival of this class.

**Removed files**:
- `sdk/core/src/clients/DebugInfo.ts`
- `sdk/core/src/clients/DebugInfo.test.ts` (28 unit tests)

**Modified files**:
- `sdk/core/src/clients/index.ts` — drop the `DebugInfoGatherer` re-export
- `sdk/core/src/clients/createIFrameFrakClient.ts` — drop the import, the `new DebugInfoGatherer(...)` instantiation, the `setLastRequest` / `setLastResponse` middleware block, the `updateSetupStatus` chain, and the `debugInfo` field on the returned client object
- `sdk/core/src/types/client.ts` — drop the `debugInfo` field from `FrakClient`
- `sdk/components/tests/vitest-setup.ts` — drop the `debugInfo` mock from the `window.FrakSetup.client` test fixture

**Bundle impact** (CDN, raw / gzip):

| Bundle | Before | After | Δ raw | Δ gzip |
|---|---:|---:|---:|---:|
| `sdk/core/cdn/bundle.js` (`window.FrakSDK`) | 41.1 KB / 13.9 KB | 39.0 KB / 13.2 KB | **−2.1 KB (−5.2%)** | **−0.6 KB (−4.5%)** |
| `sdk/components/cdn/loader.js` (always-loaded entry) | 47.6 KB / 15.5 KB | 45.5 KB / 14.9 KB | **−2.1 KB (−4.4%)** | **−0.6 KB (−4.0%)** |

Combined: **−4.2 KB raw / −1.2 KB gzip** across the two CDN bundles.
