# Frak Native Mobile SDK — Plan

Native Android (Kotlin) and iOS (Swift) SDKs mirroring the capabilities of
`sdk/core` + `sdk/components` + the sharing surface of `apps/listener`.

## Documents

| Doc | Content |
|---|---|
| [`01-platform-changes.md`](./01-platform-changes.md) | Changes required in `apps/wallet`, `apps/listener`, `services/backend` before/alongside native work |
| [`02-native-sdk-overview.md`](./02-native-sdk-overview.md) | What we build natively, philosophy, architecture, API surface, phasing |

## Scope (MVP)

A native app implementor must be able to:

1. Ask **what the reward is** for a product, and **what the config is** for a placement (CTA texts, etc.)
2. Send **purchase tracking** info
3. Display the **sharing modal**, including the post-share "create your wallet" install step
4. Get **current config / current campaigns** info
5. **Redirect the user to the Frak app**

Plus, cross-cutting: anonymous id generation + interaction tracking, inbound referral
(`fCtx`) link handling with the self-referral guard, and merchant matching by package id
(in addition to allowed domains).

**First client:** the My Moulinex app (`com.groupeseb.moulinex.food`). Its merchant
identity will be verified manually — no SEB domain currently publishes usable
well-known files, so auto-verification cannot be the launch path. See
[`01-platform-changes.md`](./01-platform-changes.md) §3.8.

## ⚠️ Prerequisite: identity proof-of-possession

A security review during planning found a **live, exploitable reward-theft
vulnerability in production today**, independent of native: `POST /user/identity/merge/execute`
has no authentication at all, and `merge/initiate` mints a merge token for any
`sourceAnonymousId` a caller names — an id that every share link publishes in clear.
Worse than the theft, a hostile merge **permanently locks the victim out** of ever
linking their wallet for that merchant (`WALLET_CONFLICT`).

**This is being fixed first, before any native work.** The plan lives in
[`../identity-proof-of-possession/`](../identity-proof-of-possession/): anonymous ids
become derived from a device-held P-256 keypair, and sensitive operations carry a
timestamped signature.

We do it now because we currently have almost no shares and no active users — the
legacy-id population that cannot be retrofitted is nearly empty. That window closes as
we grow.

Native consequences:
- native v0.1 ships key derivation + signing from day one (no legacy native ids, so
  native is cryptographic-only — no trust-on-first-use path)
- the `?fmt=` merge flow stays unsupported until the fix lands
- see [`01-platform-changes.md`](./01-platform-changes.md) §3.2 for the attack chain

## Core architectural decision

The web SDK is three layers, and the middle one — the `apps/listener` iframe — exists
**only because of browser origin isolation**. A merchant's page cannot hold wallet
credentials, so wallet-owning code lives cross-origin and the halves talk over
`postMessage` RPC.

**A native app is already a trust boundary. That layer is not ported.**

| Web layer | Native |
|---|---|
| `sdk/core` direct HTTP calls | port directly |
| `sdk/core` iframe-RPC calls | **replaced by the equivalent direct HTTPS endpoints — they already exist** |
| `packages/rpc` postMessage transport | **not ported** |
| `apps/listener` sharing UI | native shell hosting the existing `/sharing` route (see below) |
| `apps/listener` wallet / passkey / SSO / pairing | out of MVP |

Every RPC method the MVP needs has a direct HTTPS twin that is already `merchantId`-keyed
and performs no server-side origin check:

| Web RPC | Native HTTPS |
|---|---|
| `frak_sendInteraction` | `POST /user/track/interaction` |
| `frak_getMerchantInformation` | `GET /user/merchant/estimated-rewards?merchantId=` |
| `frak_getUserReferralStatus` | `GET /user/merchant/referral-status?merchantId=` |
| `frak_displaySharingPage` | native sheet hosting `${walletUrl}/sharing?…` |
| (config) | `GET /user/merchant/resolve?merchantId=&lang=` |
| (purchase) | `POST /user/track/purchase` |

Only one surface needs a web view: the sharing page.

## The flow we are reproducing

The existing web flow, preserved end to end:

```
Merchant app surface (product page / post-purchase / event)
  → "Share and earn {REWARD}"
  → sharing sheet: reward card, product cards, how-it-works, FAQ
  → user shares (native OS share sheet) or copies
  → PostShareConfirmation: "create your wallet to get your rewards"
  → Install CTA
      ├─ Frak app installed  → deep link, identity linked automatically
      └─ not installed       → /install flow (Android: Play Install Referrer,
                                iOS: install code + pasteboard + in-app App Store)
```

Native adds one shortcut the web cannot have: when the Frak app is already
installed, the install step becomes a direct deep link that links the anonymous
id to the wallet with no code, no store, no friction.

Two steps in that chain are easy to miss and each silently kills the funnel:
the page needs `?confirmed=1` to show `PostShareConfirmation` at all under `native=1`,
and the SDK — not the merchant — must own the install step end to end.

## Status

Planning. No implementation yet. Reviewed by architecture, security, platform-research
and codebase-gap passes; findings folded into both documents.
