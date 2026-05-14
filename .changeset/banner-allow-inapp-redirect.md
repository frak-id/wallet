---
"@frak-labs/components": patch
---

🩹 fix: `<frak-banner>` no longer auto-switches to its in-app browser redirect mode by default. A new opt-in prop `allowInappRedirect` (HTML attribute `allow-inapp-redirect="true"`) gates that behaviour, defaulting to `false`.

The redirect-out-of-embed flow was originally a workaround for WebAuthn / passkey APIs being unavailable inside Instagram / Facebook WebViews. With the anonymous-id flow now covering referral tracking, arrival attribution, purchase webhooks and `sendInteraction` without a passkey, that prompt fires unnecessarily on most placements. Merchants who actually drive users into a WebAuthn-bound action (login, SIWE authenticate, sendTransaction) can re-enable it explicitly via `<frak-banner allow-inapp-redirect="true">`.

The underlying merge-token (`?fmt=`) plumbing in `core-sdk` / `apps/listener` is unchanged — only the auto-trigger on the merchant-side `<frak-banner>` component is now opt-in.
