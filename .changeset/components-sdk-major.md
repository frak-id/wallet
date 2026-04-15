---
"@frak-labs/components": major
---

### Breaking changes

- **Removed `Spinner` component** — The standalone Spinner component has been removed.
- **Removed `setup` utilities** — `setupModalConfig` and `setupReferral` from `utils/setup.ts` are no longer available. Referral setup is now handled by `@frak-labs/core-sdk`'s `setupReferral` action directly.
- **Removed CSS Modules** — `ButtonShare.module.css`, `ButtonWallet.module.css`, and `OpenInAppButton.module.css` have been replaced by CSS-in-TS styling (`sharedCss`, `styleManager`).
- **Replaced `getCurrentReward` with `formatReward`** — The reward formatting utility has been rewritten with a new API.
- **Refactored `initFrakSdk`** — The global `frakSetupInProgress` flag is removed; concurrent initialization is now deduplicated via `withCache`. The function is synchronous-first (returns a `Promise<void>`). Core SDK is now exposed as a merged `{ ...coreSdkIndex, ...coreSdkActions }` object on `window.FrakSetup.core`.
