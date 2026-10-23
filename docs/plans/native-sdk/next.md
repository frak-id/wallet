# Native SDK — what comes next

Ordered. Each item names its precondition, so anything with an unmet precondition can be skipped
without re-deriving why.

Detail on any item is in [`open.md`](./open.md); this file is sequencing only. Almost none of it is
in Linear — [`open.md`](./open.md) §0 records which tracker owns what, which native issues exist, and
why searching here first is not optional.

## Where the line is

`1.0.0` is published on Maven Central and the SwiftPM mirror (2026-09-08, release commit
`949a5eaf6`). The ABI is frozen at it: a breaking change takes a new major. Nothing in this repo
consumes the published artifact; whether a merchant app does is unknown outside this repo.

Two things follow. The ABI decisions in `open.md` §1 were not taken before the cut, so each is now a
major, an additive change, or an accepted cost. And the first external consumer is no longer a
threshold; it is the first evidence that the published form works.

## 1. Decide the ABI items — against 1.0.0 as the baseline

**Precondition:** none. All five were open at the cut: the Android dumps at HEAD equal the ones at
`android-v1.0.0`, `purchase` is still `(String, String, String)`, `FrakContext`, `SharingResult` and
`FrakEnvironment` are still closed hierarchies, and `FrakError` has no retryable axis. Take each in
the next major, make it additively, or record in `docs/native-sdk/decisions.md` that it is accepted as is.

Five items, unowned, in [`open.md`](./open.md) §1:

1. **`FrakContext`/`SharingResult` unknown arm** — the highest-value one, and the one with a proven
   failure mode rather than a theoretical one. `SharingResult` grew a sixth arm five days after
   being "narrowed"; a `Kind` discriminator does not prevent the break.
2. **`tracking.purchase(String, String, String)`** — three unlabelled strings on the money path.
3. **`FrakError` retryable/fatal axis**, plus iOS's `LocalizedError` leaking diagnostics to users.
4. **Equality across the 8 split types** — adding it later is a behaviour change the ABI gate cannot
   see.
5. **A reliability tier in the queue row format** — a queue file on a merchant's disk cannot be
   migrated.

Also decide, less urgently: `FrakEnvironment`'s exhaustiveness (A2), and whether 9.15's remaining
call-site divergences get ported or accepted in writing.

## 2. Close the harness blind spots

**Precondition:** none. Cheap, mechanical, and the highest-yield work available — the last sweep of
this kind found three real defects the harness had been hiding, including one that printed a success
message for the failure case.

- A **two-destination `NavHost`** in `example/native-android`. This is the precondition for §3.6
  (the orphaned Compose sheet) and cannot be worked around — a single-screen harness cannot
  reproduce it.
- Call sites for the five public members with none: `setTrackingEnabled`, `resetAnonymousId`,
  `Frak.shutdown`, `heightFraction`, and the `@Composable build()` overload. Still none at
  2026-10-13, after both harnesses were split into tabs; `example/native-android` has no `NavHost`.

## 3. Port `ServerClock` to iOS, and bound it — done 2026-10-23

The port is `Net/ServerClock.swift`, fed by `HTTPClient` and read by
`AnonymousIdStore.signProof`, with the same 2025-01-01 … 2100-01-01 bound as Android.

Still open, on both platforms and to be changed together: the offset is not persisted, so a cold
start runs on the device clock until the first response.

## 4. The device tier

**Precondition:** a decision to spend on CI infrastructure.

This is what gates the largest cluster of open items. It unblocks §2.4 (the blank sheet, whose fix
was written and reverted because nothing could tell whether `postVisualStateCallback` fires for a
fragment-activated document), 9.13(a) and (b), 8.2's ~2,000 uncovered iOS lines, 9.5, and the
`frakwallet://install` device pass.

Manual passes have happened on both platforms and are not a substitute: they cover the harness, in
one build, on one screen. They cannot catch what the harness itself gets wrong, and it has been
caught doing exactly that three times.

**Done: 9.13(c), asserting the real cascade.** `apps/wallet/tests-light/specs/sharing.check.ts` reads
the computed radius and shadow in a real browser on every PR (`wallet-pages` job, `180a11fbf`), and
`assert-real-assertions.ts` fails a spec whose only assertion is a screenshot. `Ambassador.test.tsx`
compiles the real `.css.ts` and asserts the shipped declarations (`2020de05c`).

The first slice of the tier that needs no device is running the UIKit suites on a simulator: Linear
FRA-314, audit NSD-12. CI already pays for the macOS runner.

## 5. Rewards conformance, then the sharing-link corpus

**Precondition:** none for the first, none for the second.

- `golden-rewards.json` has **67 entries and is loaded by nobody** — the largest fixture file in the
  corpus, currently asserting nothing, while reward decoding is checked against hand-written
  literals. Wiring the loader is small and closes the biggest gap between what the corpus claims and
  what it does.
- Then `golden-sharing-links.json` for the 325 lines hand-ported three ways
  ([`open.md`](./open.md) §9.1). It has already produced three real divergences, including one where
  a web-built and a native-built link byte-differ on identical input with nothing to notice.
- While there: **break one byte on one platform and confirm a test fails.** The corpus has never
  caught a divergence and the deliberate-injection check has never been run, so its correctness is
  currently an assumption.

## 6. First external consumer

**Precondition:** none. 1.0.0 shipped with §1 open, so §1 no longer gates it.

Get one consumer building against the **published artifact**, not the Gradle composite build or the
SwiftPM path dependency. Everything to date has been validated through a substitution that hides
whole classes of packaging defect. iOS already resolves its published tag on every release
(`verify-published` in `release-ios-sdk.yml`); Android has no equivalent job, and the harness's
`id.frak.sdk:core:1.0.0` coordinate is replaced by the local build.

The ABI's point of no return was the 1.0.0 cut. This step now buys evidence, not budget.

## 7. Contract items needing an owner

**Precondition:** an owner. None of these is blocked on engineering.

- **The kill switch.** `?sdkVersion=` and `x-frak-sdk-version` are accepted and logged and drive
  nothing. The shape is also wrong — per-merchant where a bad release is fleet-wide and
  version-scoped. With 1.0.0 published, this is the mechanism for retiring it.
- **`embed=native` footer ownership.** The contract still calls the marker `native=1`; that param no
  longer exists (audit NSD-17). Its meaning changed, and both mismatch directions are bad: a
  double-rendered footer with a lying result channel, or no footer and a dead funnel. Needs a
  capability param or a return-channel ack. `sdkVersion` is already carried and could gate it.
- **S4** — decide whether the iOS resolve cache stays backed up, and record it either way.
- **Dark mode** — does the sheet follow the system setting?
- **Done: `ROLLOUT-STEP-3`** — closed in `d6dffc705` (2026-09-18, FRA-294). The identity
  proof-of-possession arms are mandatory. See
  [`../identity-proof-of-possession/`](../identity-proof-of-possession/).

## 8. Longer term

Not scheduled, listed so they are not rediscovered as new ideas.

| | Precondition |
|---|---|
| Native `FrakShareButton` / `FrakBanner` / `FrakPostPurchaseCard`, no web view | a sharing performance measurement on the WebView path that nobody has taken (Linear FRA-292 was canceled 2026-10-05; the gate stands) |
| `allowedPackageIds` auto-verification (Digital Asset Links, AASA) | launch is manual admin entry today |
| Android silent identity linking via a bound Service | — |
| `frakAction=share` mapping an inbound URL or push payload to a sheet | — |
| XCFramework / binary iOS distribution | forces A3/D7 — iOS's source-level freeze becomes a real ABI freeze |
| React Native | both native SDKs stable first, separate release train, never in parallel |
| Telemetry on native funnels | there is no first-party event equivalent to web's ~10 OpenPanel events, so init failures and funnel drop-off are invisible |
| ATT posture for iOS | a legal call on whether reward-linking is Apple's "shared identity across companies" |
| Cross-surface attribution | share-from-native → open-in-browser has never been validated end to end |
