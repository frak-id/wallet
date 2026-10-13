# Frak Native Mobile SDK

Native Android (Kotlin) and iOS (Swift) SDKs mirroring `sdk/core` + `sdk/components` plus the
sharing surface of `apps/listener`.

| Doc | Content |
|---|---|
| [`decisions.md`](../../native-sdk/decisions.md) | Every decision that is expensive to revisit, and why |
| [`contract.md`](../../native-sdk/contract.md) | The wire contract: `/sharing` params, the return channel, backend endpoints, golden fixtures |
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

## Status — 2026-10-13

**Published at 1.0.0.** `id.frak.sdk:core` and `id.frak.sdk:ui` at `1.0.0` are on Maven Central;
`frak-id/frak-ios-sdk` carries tag `1.0.0`. Release commit `949a5eaf6`; tags `android-v1.0.0` and
`ios-v1.0.0` sit on merge commit `35995d05c`, 2026-09-08. The Maven metadata and the mirror's tag
list were fetched on 2026-10-13.

**The ABI is frozen at 1.0.0.** The public surface of both SDKs follows semantic versioning from it:
a breaking change takes a new major (`sdk/{android,ios}/CHANGELOG.md`). The committed Android dumps
at HEAD are identical to the ones at `android-v1.0.0`. None of the ABI decisions in
[`open.md`](./open.md) §1 was taken before the cut, so each is now a major or an accepted cost.

**Consumers.** Nothing in this repo resolves a published artifact.
`example/native-android/app/build.gradle.kts:90-91` names `id.frak.sdk:core:1.0.0` and `:ui:1.0.0`,
but `settings.gradle.kts` substitutes the local build for both. `example/native-ios` is a SwiftPM
path dependency. No app, plugin or package references either coordinate. The one thing that
resolves the published form is the iOS `verify-published` job in `release-ios-sdk.yml`, which builds
a scratch package pinned `exact:` to the new tag on every release. Android has no equivalent.
Whether a merchant app consumes 1.0.0 is unknown outside this repo.

Both platforms implement the MVP surface: identity, the FrakContext v2 codec and local link
building, tracking over a durable queue, inbound `fCtx` with the self-referral guard, the install
handoff, and the sharing sheet. `FrakClient` is a sealed concrete class with five namespaces
(`config`, `rewards`, `sharing`, `tracking`, `appLink`). Licence: Apache-2.0.

| Gate | State |
|---|---|
| CI | `apps.yaml` lints, builds and unit-tests both SDKs per push/PR. Android runs the full `check` including the ABI gate |
| ABI gate | Wired and enforced. `frak-sdk/api/frak-sdk.api` + `frak-sdk-ui/api/frak-sdk-ui.api` committed, `apiCheck` green |
| Device | Android on a minified R8 build, iOS sheet on an iPhone 15, both 2026-08-13. Manual, harness-driven. No later pass is recorded here. `release-native-examples.yml` ships both harnesses to testers (TestFlight, Play internal), built from source |
| Automated device/simulator | None. CI compiles iOS tests at the simulator triple and runs them on the macOS host, so every UIKit-gated suite is type-checked and executed nowhere (Linear FRA-314). The hosted `/sharing` and `/install` pages do run in CI, in a browser: the `wallet-pages` job in `apps.yaml` |
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
[`../identity-proof-of-possession/`](../identity-proof-of-possession/). Enforcement is complete:
every route that could act on an `anonymousId` the caller holds no key for now refuses
unconditionally, with `/merge/execute` the one deliberate exception. `ROLLOUT-STEP-3`, the last
transitional marker, closed in `d6dffc705` (2026-09-18, FRA-294).

## History

This folder was 34 files and ~13k lines of audit narrative through 2026-08-14. It was consolidated
to the five documents above; the audit rounds, per-area reports and superseded plans are in git
history. Finding ids (`A3`, `9.x`, `S4`, `T3`, `B3`…) are preserved wherever an item is still open,
so older commit messages still resolve.
