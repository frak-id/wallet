# @frak-labs/core-sdk

## 0.0.11

### Patch Changes

- [`cc0e807`](https://github.com/frak-id/wallet/commit/cc0e807add74165ac56ebd3289c1d5e90bd367b9) Thanks [@srod](https://github.com/srod)! - ✨ Add BUILD_TIMESTAMP to components for dynamic CDN loading

## 0.0.10

### Patch Changes

- [#56](https://github.com/frak-id/wallet/pull/56) [`fdfcdbf`](https://github.com/frak-id/wallet/commit/fdfcdbf0133fd71dd89b87b061988c0c8225c8c0) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove unused modal `metadata.context` properties

- [#56](https://github.com/frak-id/wallet/pull/56) [`1764657`](https://github.com/frak-id/wallet/commit/176465722aafb9e392bcb62d6b504c6521ab71f8) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `i18n` properties on both embedded and modal request metadata for per modal customizations

- [#56](https://github.com/frak-id/wallet/pull/56) [`a759718`](https://github.com/frak-id/wallet/commit/a759718b2ff4cb6be21a7b8cb535299d0517f99f) Thanks [@KONFeature](https://github.com/KONFeature)! - - Update the config object to support customized `i18n` translation (deprecate the previous `metadata.xxx` properties in favor of custom i18n)

  - Move the css properties on the FrakConfig to the new customizations object

- [#57](https://github.com/frak-id/wallet/pull/57) [`5951f94`](https://github.com/frak-id/wallet/commit/5951f94b7dd5fd7e655df00e85f1d7bab03cfaaa) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove `lz-string` compression of msg, add CBOR encoding / decoding

## 0.0.9

### Patch Changes

- [`2381c27`](https://github.com/frak-id/wallet/commit/2381c274dc6240eeb96f9fd7683315ee4f052aea) Thanks [@srod](https://github.com/srod)! - ✨ Add currency support in config

## 0.0.8

### Patch Changes

- [`aa3c9f5`](https://github.com/frak-id/wallet/commit/aa3c9f5faf690110f4c5de5700c5e825e731941c) Thanks [@srod](https://github.com/srod)! - ✨ Build all SDK with rslib
  ✨ Build components SDK as a library to be published on NPM
  ✨ Refactor component loader for CDN distribution

## 0.0.7

### Patch Changes

- [`2b0c2d3`](https://github.com/frak-id/wallet/commit/2b0c2d3f2f78a3ccf1eb8be1602fb72ab4a39aaf) Thanks [@srod](https://github.com/srod)! - 🐛 Fix double publish

## 0.0.6

### Patch Changes

- [`0a82e0c`](https://github.com/frak-id/wallet/commit/0a82e0c6ea117a36ed2459fd682af52605922733) Thanks [@srod](https://github.com/srod)! - Add new config `position` to `frak-button-wallet`

## 0.0.5

### Patch Changes

- [`fef225f`](https://github.com/frak-id/wallet/commit/fef225ff27b381f0b4f4575f99e44b9dc1400d03) Thanks [@KONFeature](https://github.com/KONFeature)! - Move `hearbeat` event to `clientLifecycle` events

- [`fef225f`](https://github.com/frak-id/wallet/commit/fef225ff27b381f0b4f4575f99e44b9dc1400d03) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `handshake` and `handshake-response` events to compute the reslving context when not available

- [`64e1a8e`](https://github.com/frak-id/wallet/commit/64e1a8eee7bde61cf1fbe1ce269bfdf66f1253f7) Thanks [@KONFeature](https://github.com/KONFeature)! - Add the option to specify a `targetInteraction` for sharing modal and the `ButtonShare` component

## 0.0.4

### Patch Changes

- [`ab40feb`](https://github.com/frak-id/wallet/commit/ab40feb34e0e720027cba6090a70bf5a7aa1c867) Thanks [@KONFeature](https://github.com/KONFeature)! - Support new `retail` product types + retail related interactions

## 0.0.2

### Patch Changes

- [`b18a684`](https://github.com/frak-id/wallet/commit/b18a6841e5faa3523f178603729b7b4f6fe8dea7) Thanks [@srod](https://github.com/srod)! - Initial publish
