# Frak Native Mobile SDK — plan

Native Android (Kotlin) and iOS (Swift) SDKs mirroring `sdk/core` + `sdk/components` plus
the sharing surface of `apps/listener`.

| Doc | Content |
|---|---|
| [`01-platform-changes.md`](./01-platform-changes.md) | The contract the SDKs consume from `apps/wallet` and `services/backend` — params, return channel, endpoints. All shipped bar two items |
| [`02-sdk-design.md`](./02-sdk-design.md) | What the SDK does and the public API: principles, budget, identity, config/rewards/tracking, the namespaced `FrakClient`, phasing, open questions |
| [`03-sharing-and-install.md`](./03-sharing-and-install.md) | The sharing sheet, the web view ↔ native transport, performance, and the post-share install handoff on both platforms |
| [`04-golden-fixtures.md`](./04-golden-fixtures.md) | The cross-platform conformance corpus: contents, rules, the ICU hazard, and what it does and does not assert today |
| [`05-build-and-release.md`](./05-build-and-release.md) | Two hand-written codebases, distribution, RN, monorepo/CI, and the **ABI decisions that block the first publish** |
| [`06-open-findings.md`](./06-open-findings.md) | Merged audit register — only what is still open, with evidence |

## Scope

A native app implementor must be able to: ask what the reward is for a product and what the
config is for a placement; send purchase tracking; display the sharing modal including the
post-share install step; read current config and campaigns; and redirect the user to the Frak
app. Plus, cross-cutting: anonymous id generation and interaction tracking, inbound `fCtx`
handling with the self-referral guard, and merchant matching by package id.

**First client:** the My Moulinex app (`com.groupeseb.moulinex.food`), whose merchant
identity will be verified **manually** — no SEB domain publishes usable well-known files, so
auto-verification cannot be the launch path (`01` §3).

## The architectural decision

The web SDK is three layers, and the middle one — the `apps/listener` iframe — exists **only
because of browser origin isolation**. A native app is already a trust boundary, so that
layer is not ported.

| Web layer | Native |
|---|---|
| `sdk/core` direct HTTP calls | ported directly |
| `sdk/core` iframe-RPC calls | **replaced by the equivalent direct HTTPS endpoints — they already exist** |
| `packages/rpc` postMessage transport | **not ported** |
| `apps/listener` sharing UI | native shell hosting the existing `/sharing` route |
| `apps/listener` wallet / passkey / SSO / pairing | out of MVP |

## Status

**Both platforms implement the MVP surface**: identity (a hardware-held P-256 key and the
proof envelope), the FrakContext v2 codec and local link building, interaction and purchase
tracking over a durable queue, inbound `fCtx` with the self-referral guard, the install
handoff, and the sharing sheet — Compose in `frak-sdk-ui`, SwiftUI in `FrakSDKUI`.
`FrakClient` is a sealed concrete class with five namespaces (`config`, `rewards`, `sharing`,
`tracking`, `appLink`). The licence is Apache-2.0 for the native SDKs only.

Three places where iOS could not mirror Android, each forced rather than chosen:

| | Android | iOS |
|---|---|---|
| Identity storage | `SharedPreferences`, backup-excluded | `UserDefaults`; key in the Secure Enclave |
| Inbound links | `Automatic` via `ActivityLifecycleCallbacks` | `.manual` only — a library cannot observe a host's `Scene`/`AppDelegate` |
| Install carrier | Play referrer, deterministic | install code + pasteboard + `SKOverlay` |

**Both example apps now drive the real client** — Android as a Gradle composite build, iOS as
a SwiftPM path dependency — and the loop has run **end to end on a physical device**
(SM-G998B / Android 15): initialize → wallet-app probe → `config.resolve` returning a real
merchant → `rewards.best` returning a real reward. That is the first evidence any of this
works outside a unit test, and it retired the last stubbed *SDK surface* in the tree.

**What is still not true:**

- **The sharing sheet, the install handoff and inbound deep links have never run anywhere.**
  The device pass covered initialize, the wallet probe, config and rewards; iOS has had no device or simulator pass
  at all. Every remaining claim rests on JVM/Swift unit tests and hand-run builds.
- **No CI job builds, tests or lints either SDK.** "Green" means a human ran a command once.
  Android Lint has never executed.
- **No publish path.** `publishToMavenLocal` only; the XCFramework script is a stub.
- **No binary-compatibility gate and no committed `.api` dump** — deliberately, until the ABI
  questions in `05` §5 are answered, which is the next blocking decision. There are now seven
  of them: rewiring the examples added three member-contract questions to the four ABI ones.
- **The rewards fixture corpus is loaded by nobody**, and the corpus has never been shown to
  catch a divergence.
- 84 audit findings remain open (`06`), including all eight of round 1's security/privacy
  findings — logging, backup exclusion, unbounded reads, consent.

## Prerequisite: identity proof-of-possession — shipped

A security review during planning found a **live, exploitable reward-theft vulnerability in
production**, independent of native: `POST /user/identity/merge/execute` had no
authentication, `merge/initiate` minted a merge token for any `sourceAnonymousId` a caller
named — an id every share link publishes in clear — and `POST /user/track/interaction`
reached the same place in one request. Worse than the theft, a hostile merge **permanently
locked the victim out** of ever linking their wallet for that merchant.

**It was fixed first, before any native work** — see
[`../identity-proof-of-possession/`](../identity-proof-of-possession/). It was done then
because we had almost no shares and no active users, so the legacy-id population that cannot
be retrofitted was nearly empty. That window closes as we grow.

**What remains is enforcement, not the fix**: the wallet-facing arms are still permissive,
gated on the store binary being live, tracked as `ROLLOUT-STEP-3` in that plan's
`ROLLOUT.md`. Consequences here: native ships signing from day one (no legacy ids, so it is
cryptographic-only), the `?fmt=` merge flow stays unsupported until enforcement lands, and
rollout 3 must not ship before a store binary that emits install proofs (`03` §5).
