---
"@frak-labs/react-sdk": minor
---

### New hooks

- **`useDisplaySharingPage`** — Mutation hook wrapping the new `displaySharingPage()` action. Displays a full-page sharing UI with product info and share/copy buttons.
- **`useGetMergeToken`** — Query hook wrapping the new `getMergeToken()` action. Fetches a merge token for in-app browser redirect flows.
- **`useGetUserReferralStatus`** — Query hook wrapping the new `getUserReferralStatus()` action. Returns the current user's referral status on the merchant.
- **`useSetupReferral`** — Fire-and-forget hook wrapping the new `setupReferral()` action. Auto-processes referral context and dispatches `"frak:referral-success"` DOM event.

### Updated hooks

- **`useDisplayModal`** — Now accepts an optional `placement` field in the mutation variables.
- **`useGetMerchantInformation`** — Now accepts an optional `cacheTime` parameter to configure core SDK caching.
- **`useReferralInteraction`** — Simplified to use `referralInteraction()` directly instead of manually gathering URL context and wallet status. Now runs once (no duplicate tracking on wallet status changes) and dispatches `"frak:referral-success"` DOM event on success.

### Internal improvements

- Updated dev dependencies: TypeScript 6, Vitest 4.1, jsdom 29, tsdown 0.21.
- Removed `@frak-labs/dev-tooling` dev dependency.
