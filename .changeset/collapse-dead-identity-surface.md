---
"@frak-labs/core-sdk": patch
"@frak-labs/frame-connector": patch
---

Removed dead public exports found to have zero callers anywhere in the monorepo, backend, or test suites:

- `@frak-labs/core-sdk`: `getCache()` (the SDK-wide `withCache` layer is invalidated via `clearAllCache()`, which remains; no caller ever needed per-key invalidation).
- `@frak-labs/frame-connector`: `MethodNotFoundError`, `InternalError` (RPC error sites construct `FrakRpcError` directly instead; `FrakRpcError` and `ClientNotFound` are unaffected).

**BREAKING** if you imported either of these directly — nothing in this repo did.
