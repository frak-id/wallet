# Frak Native Mobile SDK — plan

Native Android (Kotlin) and iOS (Swift) SDKs mirroring `sdk/core` + `sdk/components` plus
the sharing surface of `apps/listener`.

| Doc | Content |
|---|---|
| [`01-platform-changes.md`](./01-platform-changes.md) | The contract the SDKs consume from `apps/wallet` and `services/backend` — params, return channel, endpoints |
| [`02-sdk-design.md`](./02-sdk-design.md) | The public API: identity, config/rewards/tracking, the namespaced `FrakClient`, open questions |
| [`03-sharing-and-install.md`](./03-sharing-and-install.md) | The sharing sheet, the web view ↔ native transport, performance, and the post-share install handoff on both platforms |
| [`04-golden-fixtures.md`](./04-golden-fixtures.md) | The cross-platform conformance corpus |
| [`05-build-and-release.md`](./05-build-and-release.md) | Distribution, RN, monorepo/CI, and the ABI decisions blocking the first publish |
| [`06-open-findings.md`](./06-open-findings.md) | Merged audit register — only what is still open |
| [`07-sharing-sheet-audit.md`](./07-sharing-sheet-audit.md) | Android sharing sheet: why it janks (verified against Compose M3 1.4.0 and the WebView draw-functor ABI), four correctness defects, and the Stripe-shaped API surface that replaces the Compose-only entry point |
| [`08-sharing-sheet-api.md`](./08-sharing-sheet-api.md) | Replacing the Compose-only sheet entry point with a Stripe-`PaymentSheet`-shaped `Builder`: why we take Stripe's API but not its Activity, dropping `ModalBottomSheet` for a `ComponentDialog`, rotation survival, and the sequence to XML/Java/UIKit support |

## Scope

A native app implementor must be able to: ask what the reward is for a product and what the
config is for a placement; send purchase tracking; display the sharing modal including the
post-share install step; read current config and campaigns; and redirect the user to the Frak
app. Plus, cross-cutting: anonymous id generation and interaction tracking, inbound `fCtx`
handling with the self-referral guard, and merchant matching by package id.

First client: the My Moulinex app (`com.groupeseb.moulinex.food`), verified manually — no SEB
domain publishes usable well-known files.

## The architectural decision

The web SDK is three layers, and the middle one — the `apps/listener` iframe — exists only
because of browser origin isolation. A native app is already a trust boundary, so that layer
is not ported.

| Web layer | Native |
|---|---|
| `sdk/core` direct HTTP calls | ported directly |
| `sdk/core` iframe-RPC calls | replaced by the equivalent direct HTTPS endpoints |
| `packages/rpc` postMessage transport | not ported |
| `apps/listener` sharing UI | native shell hosting the existing `/sharing` route |
| `apps/listener` wallet / passkey / SSO / pairing | out of MVP |

## Status

Both platforms implement the MVP surface: identity, the FrakContext v2 codec and local link
building, tracking over a durable queue, inbound `fCtx` with the self-referral guard, the
install handoff, and the sharing sheet. `FrakClient` is a sealed concrete class with five
namespaces (`config`, `rewards`, `sharing`, `tracking`, `appLink`). Licence: Apache-2.0.

One Android device pass (SM-G998B / Android 15) has exercised `initialize`, the
wallet-installed probe, `config.resolve` and `rewards.best`. The sharing sheet, the install
handoff and inbound deep links have run nowhere; iOS has had no device or simulator pass at
all. No CI job builds either SDK, and there is no publish path or binary-compatibility gate
(`05` §5). Four findings block the first publish and the security/privacy register is still open — see `06`.

Three places where iOS could not mirror Android, each forced rather than chosen:

| | Android | iOS |
|---|---|---|
| Identity storage | `SharedPreferences`, backup-excluded | `UserDefaults`; key in the Secure Enclave |
| Inbound links | `Automatic` via `ActivityLifecycleCallbacks` | `.manual` only — a library cannot observe a host's `Scene`/`AppDelegate` |
| Install carrier | Play referrer, deterministic | install code + pasteboard + `SKOverlay` |

## Prerequisite: identity proof-of-possession

A security review found a live reward-theft vulnerability in production, independent of
native: identity-merge endpoints had no authentication. It was fixed before native work
started — see [`../identity-proof-of-possession/`](../identity-proof-of-possession/).
Enforcement (the wallet-facing arms going from permissive to mandatory) is still open, gated
on a store binary being live, tracked as `ROLLOUT-STEP-3`. Until then native ships signing
from day one and the `?fmt=` merge flow stays unsupported.
