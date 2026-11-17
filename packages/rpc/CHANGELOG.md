# @frak-labs/frame-connector

## 1.7.0

### Minor Changes

- [#449](https://github.com/frak-id/wallet/pull/449) [`0cb4743`](https://github.com/frak-id/wallet/commit/0cb4743932f92b82cb20db6f43d7f05984eac95e) Thanks [@srod](https://github.com/srod)! - SDK requests no longer wait forever for a wallet iframe that never connects: after 30 seconds they fail with `clientNotConnected`, `waitForConnection` resolves `false`, and `setupClient` detaches the client and returns `undefined` instead of hanging. A response that an `onResponse` middleware cannot process now rejects its request instead of leaving it pending, and closes a `listen()` stream instead of skipping that chunk. `listen()` takes an optional `onError` callback that receives the failure when a stream cannot be sent, the wallet answers with an error, or a response middleware throws. `watchWalletStatus` with a callback now rejects in that case instead of hanging. `cleanup()`, which `client.destroy()` runs, now rejects requests still in flight and reports open streams to `onError` with `clientNotConnected`, and a request made after it fails without being sent, so a provider remount no longer leaves `useWalletStatus` pending forever.

## 1.5.2

### Patch Changes

- [#336](https://github.com/frak-id/wallet/pull/336) [`4724991`](https://github.com/frak-id/wallet/commit/472499121b34a5e5717c344305dfddefa13664ce) Thanks [@srod](https://github.com/srod)! - Published through npm trusted publishing, with a provenance attestation.

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
