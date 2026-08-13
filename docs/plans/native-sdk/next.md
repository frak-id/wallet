# Native SDK — what comes next

Ordered. Each item names its precondition, so anything with an unmet precondition can be skipped
without re-deriving why.

Detail on any item is in [`open.md`](./open.md); this file is sequencing only.

## Where the line is

`1.0.0-beta.1` is published on Maven Central and the SwiftPM mirror, and **nothing consumes it yet**.
That is the whole strategic position: the ABI is nominally frozen but practically still free, and
that stops the moment a merchant integrates.

Two things follow. Every ABI decision in `open.md` §1 should be taken while the beta line is still
uncontended. And the first external consumer should be deliberate, not accidental — it converts the
remaining ABI budget to zero.

## 1. Decide the ABI items — before `1.0.0`

**Precondition:** none. This is the only work that gets *more* expensive by waiting.

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
  `Frak.shutdown`, `heightFraction`, and the `@Composable build()` overload.

## 3. Port `ServerClock` to iOS, and bound it

**Precondition:** none.

The clock-skew fix shipped on Android only, which makes it the largest remaining parity gap: an iOS
device 61 s fast fails every proof, non-retryably. Two things to fix together, since the port should
not carry the flaw:

- `ServerClock` has no upper bound — a proxy sending `Date: 2100` skews every proof.
- It is not persisted, so a cold start runs on the device clock until the first response.

## 4. The device tier

**Precondition:** a decision to spend on CI infrastructure.

This is what gates the largest cluster of open items. It unblocks §2.4 (the blank sheet, whose fix
was written and reverted because nothing could tell whether `postVisualStateCallback` fires for a
fragment-activated document), 9.13(a) and (b), 8.2's ~2,000 uncovered iOS lines, 9.5, and the
`frakwallet://install` device pass.

Manual passes have happened on both platforms and are not a substitute: they cover the harness, in
one build, on one screen. They cannot catch what the harness itself gets wrong, and it has been
caught doing exactly that three times.

One piece of this does **not** need the tier and can land now: **9.13(c), a build-output CSS
assertion.** Vanilla Extract emits static CSS at build time and `@vanilla-extract/vite-plugin` is
already a dependency. No test in the repo reads emitted CSS, which is why a cascade bug survived a
test named for the exact behaviour it broke.

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

**Precondition:** §1 decided.

Get one consumer building against the **published artifact**, not the Gradle composite build or the
SwiftPM path dependency. Everything to date has been validated through a substitution that hides
whole classes of packaging defect.

This is the point of no return for the ABI. Do not reach it with §1 open.

## 7. Contract items needing an owner

**Precondition:** an owner. None of these is blocked on engineering.

- **The kill switch.** `?sdkv=` and `x-frak-sdk-version` are accepted and logged and drive nothing.
  The shape is also wrong — per-merchant where a bad release is fleet-wide and version-scoped. Now
  that a version is published, this is the mechanism for retiring it.
- **`native=1` footer ownership.** The marker's meaning changed, and both mismatch directions are
  bad: a double-rendered footer with a lying result channel, or no footer and a dead funnel. Needs a
  capability param or a return-channel ack. `sdkv` is already carried and could gate it.
- **S4** — decide whether the iOS resolve cache stays backed up, and record it either way.
- **Dark mode** — does the sheet follow the system setting?
- **`ROLLOUT-STEP-3`** — the identity proof-of-possession arms go mandatory, gated on a store binary
  being live. See [`../identity-proof-of-possession/`](../identity-proof-of-possession/).

## 8. Longer term

Not scheduled, listed so they are not rediscovered as new ideas.

| | Precondition |
|---|---|
| Native `FrakShareButton` / `FrakBanner` / `FrakPostPurchaseCard`, no web view | a sharing performance measurement on the WebView path that nobody has taken |
| `allowedPackageIds` auto-verification (Digital Asset Links, AASA) | launch is manual admin entry today |
| Android silent identity linking via a bound Service | — |
| `frakAction=share` mapping an inbound URL or push payload to a sheet | — |
| XCFramework / binary iOS distribution | forces A3/D7 — iOS's source-level freeze becomes a real ABI freeze |
| React Native | both native SDKs stable first, separate release train, never in parallel |
| Telemetry on native funnels | there is no first-party event equivalent to web's ~10 OpenPanel events, so init failures and funnel drop-off are invisible |
| ATT posture for iOS | a legal call on whether reward-linking is Apple's "shared identity across companies" |
| Cross-surface attribution | share-from-native → open-in-browser has never been validated end to end |
