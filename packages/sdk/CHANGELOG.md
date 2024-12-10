# @frak-labs/nexus-sdk

## 0.0.24

### Patch Changes

- [`fbb4020`](https://github.com/frak-id/wallet/commit/fbb402094f139824d8cd64aff6fc50834514d5e7) Thanks [@srod](https://github.com/srod)! - - ✨ Add new `core` action `getProductInformation`
  - ✨ Add new `react` hook `useGetProductInformation`
  - ♻️ Update some configs to be optionals
  - 🐛 Fix case when iframe already exists, remove old iframe

## 0.0.23

### Patch Changes

- [`8fe1ebc`](https://github.com/frak-id/wallet/commit/8fe1ebc83ec96c6468aad013d9deb03c838b6987) Thanks [@KONFeature](https://github.com/KONFeature)! - Add a `modalBuilder` to ease modal creation

## 0.0.22

### Patch Changes

- [`d10d058`](https://github.com/frak-id/wallet/commit/d10d05891bb2bf4f38a3a05edac023251e4133aa) Thanks [@srod](https://github.com/srod)! - Disable share button until iframe is ready

## 0.0.21

### Patch Changes

- [`548faf9`](https://github.com/frak-id/wallet/commit/548faf907fbe376160c57a882174fb2794bf15cb) Thanks [@KONFeature](https://github.com/KONFeature)! - Don't always append the current URL with the FrakContext

## 0.0.20

### Patch Changes

- [`666a5aa`](https://github.com/frak-id/wallet/commit/666a5aa89cb2d2281a2e88f66cca53a68dcef5d1) Thanks [@KONFeature](https://github.com/KONFeature)! - Don't spam connection request in case of a modal dismiss

## 0.0.19

### Patch Changes

- [`76cbf40`](https://github.com/frak-id/wallet/commit/76cbf40a2be2b493be0532f2de9c19d8c198b1d0) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix `Bufffer` not accessible in browser context

## 0.0.18

### Patch Changes

- [`ce1ef14`](https://github.com/frak-id/wallet/commit/ce1ef14a920b186e2572c54d685937b47761c221) Thanks [@KONFeature](https://github.com/KONFeature)! - Simplify `FrakContextManager` for to simple b64 encoding

## 0.0.17

### Patch Changes

- [`966662a`](https://github.com/frak-id/wallet/commit/966662a21f778c2560bf73ddd62f614dbc3376bb) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix: protect context with encoded uri

## 0.0.16

### Patch Changes

- [`62e0d41`](https://github.com/frak-id/wallet/commit/62e0d41cffd532cf037fa39a885f8e31f92270cb) Thanks [@KONFeature](https://github.com/KONFeature)! - Adding the `interactionToken` to the walletStatus, used to directly push interactions to the delegator

- [`6780f93`](https://github.com/frak-id/wallet/commit/6780f939a3827ebf05beab74ae1cde2f4bfad16b) Thanks [@KONFeature](https://github.com/KONFeature)! - New `final` modal step, replacing previous `success` one. Also handling dismiss case

## 0.0.15

### Patch Changes

- [`cdacb66`](https://github.com/frak-id/wallet/commit/cdacb6685516e9a1a6e7a3c4d87abd3f888853ef) Thanks [@KONFeature](https://github.com/KONFeature)! - Expose a bundle for vanilla js usage

## 0.0.14

### Patch Changes

- [`8e69dfd`](https://github.com/frak-id/wallet/commit/8e69dfd51015bfbbe9f02d2ae5431da1459e7a1f) Thanks [@KONFeature](https://github.com/KONFeature)! - Update the `siweAuthenticate` params to accept number in timestamp in places of Date object

## 0.0.13

### Patch Changes

- [`f8c200a`](https://github.com/frak-id/wallet/commit/f8c200acb1304b9390509ad440a47ba336b578d9) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix `useReferralInteraction` to directly populate nexus context if user is logged in

## 0.0.12

### Patch Changes

- [`3aca02c`](https://github.com/frak-id/wallet/commit/3aca02c223236c3d176edff6130d8ebb874262d5) Thanks [@KONFeature](https://github.com/KONFeature)! - Reduce login modal frequency with `useReferralInteraction` hook

## 0.0.11

### Patch Changes

- [`3e52138`](https://github.com/frak-id/wallet/commit/3e521385bb1c0e452da21eb746781730c9269250) Thanks [@KONFeature](https://github.com/KONFeature)! - Create a generic `displayModal` endpoint to craft nice modals where user manual validations is needed

- [`f653237`](https://github.com/frak-id/wallet/commit/f653237a1b2b4d4cba926ebc01dba1d9c5d9b717) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove gating related functionnality, and so `watchUnlockStatus` and `getUnlockOptions` hooks

- [`d5f797e`](https://github.com/frak-id/wallet/commit/d5f797e6c981fef852df523d7ea6a6baebb59af7) Thanks [@KONFeature](https://github.com/KONFeature)! - Add the current interaction session state to the walletStatus rpc endpoint

## 0.0.10

### Patch Changes

- [`4fd74e0`](https://github.com/frak-id/wallet/commit/4fd74e03d93584109e9a308900fc4a30f517724c) Thanks [@KONFeature](https://github.com/KONFeature)! - Removed previous `frak_listenToSetUserReferred` rpc action in favor of the new generic interaction handler

- [`30e3863`](https://github.com/frak-id/wallet/commit/30e3863dfdbfa80d319d988226b64d73c668a7bf) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `frak_sendTransaction` rpc action on the wallet. Only callable from dapp inside the `frak.id` domain for now.

- [`4fd74e0`](https://github.com/frak-id/wallet/commit/4fd74e03d93584109e9a308900fc4a30f517724c) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `frak_sendInteraction` rpc action to submit user interaction from a content / product

- [`e3d003f`](https://github.com/frak-id/wallet/commit/e3d003f046b5215c83711af7758da76002216617) Thanks [@KONFeature](https://github.com/KONFeature)! - Adding `domain` field in the nexus config (auto filled when using the react component `NexusConfigProvider`)

- [`e3d003f`](https://github.com/frak-id/wallet/commit/e3d003f046b5215c83711af7758da76002216617) Thanks [@KONFeature](https://github.com/KONFeature)! - Added the `siweAuthenticate` method (with the react hook) to craft strong authentication with the nexus wallet

## 0.0.9

### Patch Changes

- [#15](https://github.com/frak-id/wallet/pull/15) [`8deee63`](https://github.com/frak-id/wallet/commit/8deee631ca182dc85dd29f157ae27350f7809c94) Thanks [@srod](https://github.com/srod)! - Add referral workflow

## 0.0.8

### Patch Changes

- [`8d4783b`](https://github.com/frak-id/wallet/commit/8d4783b0ba0143a720bfd765711932fa634f5ce4) Thanks [@KONFeature](https://github.com/KONFeature)! - Move `contentId` away from global config in favor of per hook specification

## 0.0.7

### Patch Changes

- [`83efee2`](https://github.com/frak-id/wallet/commit/83efee2971b163465eb34bce5de26f9c08c1e180) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix useQuery caching issue

## 0.0.6

### Patch Changes

- [#7](https://github.com/frak-id/wallet/pull/7) [`b81ccba`](https://github.com/frak-id/wallet/commit/b81ccbafdc630d56b2f343e84b9d9df2b2e15668) Thanks [@srod](https://github.com/srod)! - Update dependencies, some texts and comments

## 0.0.5

### Patch Changes

- [#5](https://github.com/frak-id/wallet/pull/5) [`00dee0a`](https://github.com/frak-id/wallet/commit/00dee0a3d8750eddb69c2c138489ef0599ecb36c) Thanks [@srod](https://github.com/srod)! - Update dependencies, some texts and comments

- [#3](https://github.com/frak-id/wallet/pull/3) [`e45ef6d`](https://github.com/frak-id/wallet/commit/e45ef6d081dd7d4e0c868e31ce22412332925e80) Thanks [@srod](https://github.com/srod)! - Update dependencies, some texts and comments

- [#4](https://github.com/frak-id/wallet/pull/4) [`d66e667`](https://github.com/frak-id/wallet/commit/d66e667a0f62f6f81f4e01af665b20f85cb10a1b) Thanks [@srod](https://github.com/srod)! - Update dependencies, some texts and comments

## 0.0.4

### Patch Changes

- [`b21bd89`](https://github.com/frak-id/wallet/commit/b21bd89a501243b011a3daa673af10badbe632f2) Thanks [@KONFeature](https://github.com/KONFeature)! - Adding react providers and hooks to the SDK

## 0.0.3

### Patch Changes

- Initial version
