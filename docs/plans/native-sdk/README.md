# Frak Native Mobile SDK — Plan

Native Android (Kotlin) and iOS (Swift) SDKs mirroring the capabilities of
`sdk/core` + `sdk/components` + the sharing surface of `apps/listener`.

## Documents

| Doc | Content |
|---|---|
| [`01-platform-changes.md`](./01-platform-changes.md) | Changes required in `apps/wallet`, `apps/listener`, `services/backend` before/alongside native work |
| [`02-native-sdk-overview.md`](./02-native-sdk-overview.md) | What we build natively, philosophy, architecture, API surface, phasing |
| [`03-implementation-strategy.md`](./03-implementation-strategy.md) | How we build and ship it: two native codebases vs a shared core, distribution, React Native, monorepo integration, and the v0.1 POC scope |
| [`04-golden-fixtures.md`](./04-golden-fixtures.md) | The cross-platform conformance corpus: what it covers, the envelope, regeneration, how Kotlin and Swift consume it, and the ICU/invisible-character hazard |
| [`05-audit-findings.md`](./05-audit-findings.md) | Audit of the Android + iOS core SDKs: ship blockers, security/privacy, concurrency, networking, ABI, DX, tests |
| [`06-abi-decisions.md`](./06-abi-decisions.md) | **Open** ABI questions blocking the first publish: the `$default` constructor freeze, `@InternalFrakApi` vs promotion, iOS's now-public `init(from:)`. Note there is **no committed `.api` dump** — BCV was wired and then deliberately removed while the shape is unfrozen; it returns before the first publish |
| [`07-audit-round-2.md`](./07-audit-round-2.md) | Second audit of both SDKs after the first remediation pass: ship blockers, correctness, security, performance, simplification, tests. Findings are annotated in place as they are fixed |
| [`08-install-flow.md`](./08-install-flow.md) | **Design.** The step after a share: install-code handoff, `SKOverlay`, when the `frak-install-v1` proof is minted, and the `returnToHost` contract. Blocks rollout 3 — iOS emits no proof today, so it stops working when proofs become mandatory |
| [`09-api-shape.md`](./09-api-shape.md) | **Decision.** `FrakClient` stops being an interface and its members split into five domain namespaces. Resolves the `FrakClient`-growth hazard `06` recorded but left open; shares `06`'s deadline, and lands before the BCV dump is committed |
| [`10-example-rewiring.md`](./10-example-rewiring.md) | **Findings.** Both example apps rewired off their stubs onto the real SDK, closing `09` §8 and `05` D2. Confirms two-level namespacing reads well; finds eight contract defects in the members inside those namespaces — five fixed, three (`O1`–`O3`) still needing a decision before the ABI freeze |

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
[`01-platform-changes.md`](./01-platform-changes.md) §3.5.

## Prerequisite: identity proof-of-possession — shipped

A security review during planning found a **live, exploitable reward-theft
vulnerability in production**, independent of native: `POST /user/identity/merge/execute`
had no authentication at all, `merge/initiate` minted a merge token for any
`sourceAnonymousId` a caller named — an id that every share link publishes in clear —
and `POST /user/track/interaction` reached the same place in a single request. Worse
than the theft, a hostile merge **permanently locked the victim out** of ever linking
their wallet for that merchant (`WALLET_CONFLICT`).

**It was fixed first, before any native work.** The plan lives in
[`../identity-proof-of-possession/`](../identity-proof-of-possession/) and has shipped:
anonymous ids are derived from a device-held P-256 keypair, sensitive operations carry a
timestamped signature, `track/*` is resolve-only and rate-limited, the install code is
exchanged for an opaque ticket, and the unauthenticated pairing merge is gone.

We did it then because we had almost no shares and no active users — the legacy-id
population that cannot be retrofitted was nearly empty. That window closes as we grow.

**What remains is enforcement, not the fix.** The wallet-facing arms are still
permissive, gated on the store binary being live and `minVersion` excluding older builds
— tracked as `ROLLOUT-STEP-3` in
[`../identity-proof-of-possession/ROLLOUT.md`](../identity-proof-of-possession/ROLLOUT.md).
It does not block the POC; see `03` §6.1b.

Native consequences:

- native v0.1 ships key derivation + signing from day one (no legacy native ids, so
  native is cryptographic-only — no trust-on-first-use path). The frozen layout and its
  golden fixtures live at `sdk/core/src/identity/canonical.ts` and
  `sdk/core/src/identity/fixtures/` — that is what a native port reproduces
- the `?fmt=` merge flow stays unsupported until enforcement lands
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

Planning, plus scaffolding. Reviewed by architecture, security, platform-research
and codebase-gap passes; findings folded into `01` and `02`.

**Landed so far** — `03` §7 item 5, commit `1e56f0c32`, the ground for the POC:

| | State |
|---|---|
| `sdk/android/` | Gradle multi-module library, `:frak-sdk` + `:frak-sdk-ui`, `explicitApi()`, consumer R8 rules, scoped `<queries>`, backup-exclusion resource. `assembleRelease` / `ktlintCheck` / `test` / `publishToMavenLocal` last passed on a maintainer's machine — see the caveat below. |
| `sdk/ios/` | SwiftPM package, `FrakSDK` + `FrakSDKUI`, real `PrivacyInfo.xcprivacy` on **both** targets. `build` / `test` / `lint` last passed on a maintainer's machine at an explicit iOS-simulator triple with `-swift-version 6`. |
| Monorepo wiring | `biome.json` exclusions (already present), `knip.ts` `ignoreWorkspaces`, `.changeset` `ignore`, `.gitignore` build outputs, `AGENTS.md` + `sdk/AGENTS.md`. |

> ⚠️ **"Green" here means "a human ran it once", not "a gate enforces it".** No CI job
> builds, tests or lints either SDK, so none of these results is reproducible on demand
> and none is re-checked on a change. The stale outputs under `sdk/android/**/build/`
> are from an *older tree* — they contain a test file that no longer exists — and are
> not evidence of the current state. CI and publishing land together, once the first
> local and dev-environment tests have exercised the SDKs on a device.

**Both platforms now implement the MVP surface.** Identity (a hardware-held P-256
keypair and the proof envelope), the FrakContext v2 codec and local link building,
interaction and purchase tracking over a durable queue, inbound `fCtx` handling with
the self-referral guard, the install handoff, and the sharing sheet — Compose in
`frak-sdk-ui`, SwiftUI in `FrakSDKUI`.

Three places where iOS could not mirror Android, each forced rather than chosen:

| | Android | iOS |
| --- | --- | --- |
| Identity storage | `SharedPreferences`, backup-excluded | `UserDefaults` (§4 rejects Keychain), key in the Secure Enclave |
| Inbound links | `DeepLinkHandling.Automatic` via `ActivityLifecycleCallbacks` | `.manual` only — a library cannot observe a host's `Scene`/`AppDelegate` |
| Install fallback | Play Store URL carrying an install referrer, proof included | plain App Store URL, **carrying nothing** |

The last one is the one with product consequence: on iOS the identity handoff
completes only when the wallet is already installed and the deep link fires. A user
who installs from the store arrives unlinked until the install-code + pasteboard +
`SKStoreProductViewController` flow of `02` §6 is built. `ProofCodec` and
`signProof` ship anyway, asserted against the corpus — a released binary cannot be
retrofitted, so the signing half has to be in the store build before the backend
half is enforced.

Both wire formats are asserted against the golden corpus rather than against
each other. **Nothing has run on a device on either platform**, and no CI job
builds or tests either SDK — every claim rests on JVM unit tests and a release
build run by hand.

One decision this surfaced and did not settle: the Android dex budget had to be
raised from the 150 KB `02` §1.2 states to 256 KB once the surface was complete.

**The licence is settled: Apache-2.0** for the native SDKs only
(`sdk/{android,ios}/LICENSE`), deliberately diverging from the monorepo's GPL-3.0.
GPL is defensible for a CDN bundle loaded at runtime; it is a much bigger ask for an
artifact a merchant statically links into a proprietary store binary, and merchant
legal teams would refuse. Apache-2.0 over MIT for the explicit patent grant — which
covers the identity proof-of-possession scheme — and the trademark clause.

The OpenAPI export (`03` §7 item 2) is **done for the MVP surface** — four defects
found and fixed in `b8142a96e` and `3578e5c92`, from a missing document envelope to three
of six MVP routes declaring no response schema at all.

Still open before the POC loop (`03` §7): Maven Central Portal namespace verification
and the Portal transport itself (only `publishToMavenLocal` is wired), CI for both
SDKs, and the reward-formatting corpus — `golden-rewards.json` exists but **neither**
the Swift nor the Kotlin suite loads it, so reward decoding is asserted against
hand-written literals rather than the corpus on both platforms.

`03-implementation-strategy.md` adds the build-and-ship decisions the first two
documents leave open (code sharing, distribution, React Native, monorepo integration)
and corrects three claims in them: the CocoaPods and Maven Central distribution
targets, and the "first production Kotlin/Swift codebase" premise of `02` §12
question 6.

It also reframes v0.1: the MVP scope in `02` §11 is preceded by a deliberately thin
**POC** that proves one share loop end to end on both platforms, driven by example apps
under `example/native-{android,ios}/` — which are not a demo but the only way to run a
native SDK at all. See `03` §6.

**The POC is internal only.** No merchant integrates it, Moulinex included; they get the
hardened MVP. That is what makes the §6.1 cuts safe. The security checklist it used to
split has largely closed itself: the identity plan shipped, so `track/*` is resolve-only
and the raw-address bypass is gone. What is left is `merge/execute` enforcement — which
waits on a store rollout regardless and does not block, a decision recorded in
`03` §6.1b — plus rate limiting the two native-specific config endpoints (`01` §3.3).
