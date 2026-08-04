# @frak-labs/frame-connector

## 1.3.0

### Patch Changes

- [#287](https://github.com/frak-id/wallet/pull/287) [`e3976ce`](https://github.com/frak-id/wallet/commit/e3976ce2b9af1f1f7a13e9999d63032a748e5d77) Thanks [@KONFeature](https://github.com/KONFeature)! - Removed dead public exports found to have zero callers anywhere in the monorepo, backend, or test suites:

  - `@frak-labs/core-sdk`: `getCache()` (the SDK-wide `withCache` layer is invalidated via `clearAllCache()`, which remains; no caller ever needed per-key invalidation).
  - `@frak-labs/frame-connector`: `MethodNotFoundError`, `InternalError` (RPC error sites construct `FrakRpcError` directly instead; `FrakRpcError` and `ClientNotFound` are unaffected).

  **BREAKING** if you imported either of these directly — nothing in this repo did.

## 0.2.0

### Minor Changes

- [#133](https://github.com/frak-id/wallet/pull/133) [`a6c77fd`](https://github.com/frak-id/wallet/commit/a6c77fd2155a7a2038a13e6a766b160897aa2f98) Thanks [@srod](https://github.com/srod)! - Replace CBOR with JSON compression, add inter-window RPC for SSO communication, fix param extraction from data envelope, and add SSO redirect handling with lifecycle middleware.

## 0.1.0

### Minor Changes

- [#113](https://github.com/frak-id/wallet/pull/113) [`2ff23da`](https://github.com/frak-id/wallet/commit/2ff23dad85825d0b28ea1b4ad743f37405711b01) Thanks [@KONFeature](https://github.com/KONFeature)! - Publish @frak-labs/frame-connector as a standalone package - a type-safe RPC layer for cross-window postMessage communication

### Patch Changes

- [#113](https://github.com/frak-id/wallet/pull/113) [`3b111c4`](https://github.com/frak-id/wallet/commit/3b111c44109e7bd23e2b7fbe4056b8c153af101d) Thanks [@KONFeature](https://github.com/KONFeature)! - Review inter frame communication (sso <> wallet | sdk <> wallet)
