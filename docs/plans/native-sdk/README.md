# Frak Native Mobile SDK

Native Android (Kotlin) and iOS (Swift) SDKs mirroring `sdk/core` + `sdk/components` plus the
sharing surface of `apps/listener`.

| Doc | Content |
|---|---|
| [`decisions.md`](./decisions.md) | Every decision that is expensive to revisit, and why |
| [`contract.md`](./contract.md) | The wire contract: `/sharing` params, the return channel, backend endpoints, golden fixtures |
| [`open.md`](./open.md) | What is still open, ranked |
| [`next.md`](./next.md) | What comes next, ordered, with preconditions |

Merchant-facing docs live with the code: `sdk/android/README.md`, `sdk/ios/README.md`,
`sdk/AGENTS.md`. This folder is for decisions and gaps, not usage.

## Scope

A native app implementor must be able to: ask what the reward is for a product and what the config
is for a placement; send purchase tracking; display the sharing modal including the post-share
install step; read current config and campaigns; and redirect the user to the Frak app. Plus,
cross-cutting: anonymous id generation, interaction tracking, inbound `fCtx` with the self-referral
guard, and merchant matching by package id.

First client: the My Moulinex app (`com.groupeseb.moulinex.food`), verified manually — no SEB domain
publishes usable well-known files.

## The architectural decision

The web SDK is three layers, and the middle one — the `apps/listener` iframe — exists only because
of browser origin isolation. A native app is already a trust boundary, so that layer is not ported.

| Web layer | Native |
|---|---|
| `sdk/core` direct HTTP calls | ported directly |
| `sdk/core` iframe-RPC calls | replaced by the equivalent direct HTTPS endpoints |
| `packages/rpc` postMessage transport | not ported |
| `apps/listener` sharing UI | native shell hosting the existing `/sharing` route |
| `apps/listener` wallet / passkey / SSO / pairing | out of MVP |

## Status — 2026-08-14

**Published.** `id.frak.sdk:core` and `id.frak.sdk:ui` at `1.0.0-beta.1` are on Maven Central;
`frak-id/frak-ios-sdk` carries tag `1.0.0-beta.1`. Both release workflows ran green on 2026-08-13
from tag `0a5b873a4`. Nothing has consumed a published artifact yet — the harnesses still use a
Gradle composite build and a SwiftPM path dependency.

This closes the window the planning docs were written against. Anything ABI-irreversible is no
longer "free now, expensive later" — it is a break against a published coordinate, and the
remaining budget for taking one is the rest of the `beta` line. See [`open.md`](./open.md) §1.

Both platforms implement the MVP surface: identity, the FrakContext v2 codec and local link
building, tracking over a durable queue, inbound `fCtx` with the self-referral guard, the install
handoff, and the sharing sheet. `FrakClient` is a sealed concrete class with five namespaces
(`config`, `rewards`, `sharing`, `tracking`, `appLink`). Licence: Apache-2.0.

| Gate | State |
|---|---|
| CI | `apps.yaml` lints, builds and unit-tests both SDKs per push/PR. Android runs the full `check` including the ABI gate |
| ABI gate | Wired and enforced. `frak-sdk/api/frak-sdk.api` + `frak-sdk-ui/api/frak-sdk-ui.api` committed, `apiCheck` green |
| Device | Android on a minified R8 build, iOS sheet on an iPhone 15, both 2026-08-13. Manual, harness-driven, single-screen |
| Automated device/simulator | None. CI compiles iOS tests at the simulator triple and runs them on the macOS host, so every UIKit-gated suite is type-checked and executed nowhere |
| XCFramework | `do_xcframework()` still `die`s "not implemented". Source distribution only |

Three places where iOS could not mirror Android, each forced rather than chosen:

| | Android | iOS |
|---|---|---|
| Identity storage | key in `AndroidKeyStore`, non-exportable | key in a backup-excluded file; Secure Enclave when available, raw scalar otherwise |
| Inbound links | `Automatic` via `ActivityLifecycleCallbacks` | `.manual` only — a library cannot observe a host's `Scene`/`AppDelegate` |
| Install carrier | Play referrer, deterministic | install code + pasteboard + `SKOverlay` |

## Prerequisite: identity proof-of-possession

A security review found a live reward-theft vulnerability in production, independent of native:
identity-merge endpoints had no authentication. It was fixed before native work started — see
[`../identity-proof-of-possession/`](../identity-proof-of-possession/). Enforcement (the
wallet-facing arms going from permissive to mandatory) is still open, gated on a store binary being
live, tracked as `ROLLOUT-STEP-3`.

## History

This folder was 34 files and ~13k lines of audit narrative through 2026-08-14. It was consolidated
to the five documents above; the audit rounds, per-area reports and superseded plans are in git
history. Finding ids (`A3`, `9.x`, `S4`, `T3`, `B3`…) are preserved wherever an item is still open,
so older commit messages still resolve.
