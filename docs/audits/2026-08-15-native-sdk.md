# Native Android and iOS SDKs and their side effects - Audit

**Date:** 2026-08-15 · **Branch:** `dev` · **HEAD:** `a9e4dc543` · **Range audited:** `cd50f13f8^..a9e4dc543` (164 commits, 2026-08-02 → 2026-08-14), plus the `/sharing` + `/install` platform work that precedes it on the same feature line.

## Status — re-verified 2026-09-04 against `5f7c52f33`

**Zero of 27 findings are closed.** No commit in `cd50f13f8..5f7c52f33` touched any finding's path with intent to fix it; the SDKs moved to `1.0.0-beta.2` around them. What changed is the grading: the money-path premise behind NSD-2/3/4/6 does not hold, and one hygiene item was wrong when written. Severity is graded on reachable damage, so the two coverage/doc findings that decayed since the audit (NSD-12, NSD-17) stay Medium — they say something about how the work is done, not about what a user or an integrator can hit. Severity and priority in the table below are the **2026-08-15 values**, left so cross-references resolve; the appended status column carries the 2026-09-04 read and the re-grades, with the reasoning in [Re-verification 2026-09-04](#re-verification-2026-09-04).

## Owner decisions applied (2026-08-15)

These shaped the priorities below. They are judgement calls by the product owner, recorded so a future reader does not mistake them for oversights.

1. **NSD-1 is downgraded from Critical to Medium and split by platform.** The two arms share a payload but not a fix, a cost or a fate, so they are carried as **NSD-1a** (Android store rung) and **NSD-1b** (iOS custom-scheme rung). The ID space is otherwise unchanged; no other finding moved.
2. **NSD-1a is kept as a real finding (Medium, P1-next).** The fix is one line — `setPackage("com.android.vending")` — plus dropping the referrer from the browser fallback. There is no design cost and therefore no reason to carry it.
3. **NSD-1b is an accepted owner risk (Medium, Accepted-risk).** The custom scheme cannot be pinned without universal links, which is a design project rather than a patch. The owner rationale and the residual risk are recorded in the finding body; the finding is not deleted, and the acceptance is not silent.
4. **Severity is technical and unchanged; Priority is the schedule.** A finding can be technically severe and deliberately unscheduled at the same time — the two columns are independent, and nothing was deleted or softened to express a scheduling call. Priorities beyond the three decisions above follow the ordering in [Recommended next actions](#recommended-next-actions).

Priority values: `P0-now` (fix immediately) · `P1-next` (fix in the next pass) · `P2-when-picked-up` (real but not scheduled) · `Accepted-risk` (consciously accepted, will not be fixed).

## Verdict

The SDKs are structurally sound and, in places, better engineered than the web surface they mirror — the durable outbox, the WebView security posture, the identity storage decisions and the concurrency annotations are all genuinely good work, and the ABI/publish/version plumbing is real infrastructure rather than ceremony.

**After the owner decisions above, this report has no critical findings.** The install-handoff defect that previously carried the verdict is now two Medium findings with different fates: NSD-1a (Android) is a one-line pin plus a stripped referrer and is scheduled; NSD-1b (iOS) is an **accepted risk**, because the custom-scheme rung cannot be pinned without universal links. That is one accepted risk, and it is recorded with its residual blast radius rather than argued away.

What carries the verdict instead is a cluster of correctness and reliability defects on the money path. Three of them are reliability: a reconcile whose durability flag is discarded, so a failed compaction re-POSTs the whole backlog forever (NSD-2); an iOS drain with no mid-drain checkpoint and a 50× larger replay window than Android's (NSD-3); and a silent client-id drop, with no log, that also fires on a spontaneous keystore rotation (NSD-4). One is a wrong *value* on the wire: Android's `products=` encoder narrows `double`→`long`, which **saturates**, so any integral price ≥ 2^63 is sent to the backend as `9223372036854775807` (NSD-6). These matter more than their individual mechanics suggest for one structural reason — `Interaction.arrival` carries **no idempotency key**, so a replayed arrival is double-counted attribution rather than a wasted request, and there is no backend-side dedupe to absorb the mistake. The honest summary: no criticals, one accepted risk, and a correctness/reliability cluster on the path that mints money.

The accepted risk does not stand alone. NSD-1b leaks an `anonymousId` (alongside a signed install proof) to whatever app claims the scheme, and a leaked `anonymousId` **was** sufficient on its own — see AID-001 and AID-020 in [`2026-08-15-anonymous-id-proof.md`](./2026-08-15-anonymous-id-proof.md). Both are now closed, so the residual risk is back to what this section assumes: the id is useful only together with the leaked proof, inside its window. The remedy is not a native-side change and is not described here: it lives in [`../plans/identity-proof-of-possession/README.md`](../plans/identity-proof-of-possession/README.md), which is authoritative. What matters for this report is only that the dependency is real and one-directional.

Nothing here consumes a published artifact yet, which is precisely why the ABI-visible items (`Composer` in a frozen dump against `implementation`-scoped Compose, `CompletableFuture` twins that ANR when blocked on from Main) are free to fix this week and expensive the moment a merchant integrates.

## Findings at a glance

| ID | Severity | Priority | Area | One-line finding | Status (2026-09-04) |
|---|---|---|---|---|---|
| NSD-1a | Medium | P1-next | Identity / install handoff | Android: the Play Store rung is an unpinned `ACTION_VIEW` carrying merchant id, anonymous id and the signed install proof in the referrer | **Open.** Unchanged |
| NSD-1b | Medium | **Accepted-risk** | Identity / install handoff | iOS: the custom-scheme rung hands the same triple to whatever app claims `frakwallet://` — unpinnable without universal links; **accepted**, see body for residual risk | **Open, accepted.** The AID-001/AID-020 composition below is moot; both are closed |
| NSD-2 | High | **P0-now** | Tracking reliability | `EventQueue.reconcile` discards its durability result; a failed compaction silently re-POSTs the whole backlog forever | **Open · re-graded Medium / P1-next.** The premise was wrong when written: arrival is idempotent server-side (see re-verification). Reliability defect, not payout |
| NSD-3 | High | **P0-now** | Tracking reliability | iOS reconciles once after the entire backlog; Android checkpoints every 20 rows — 50× replay window on the platform with no idempotency key | **Open · re-graded Medium / P2.** Same idempotency argument; single reconcile after the loop confirmed at HEAD |
| NSD-4 | High | **P0-now** | Identity / tracking | Queued events dropped on a client-id change with no log, including on a spontaneous keystore rotation | **Open · re-graded Medium / P1-next** for the log line, P2 for the load split. iOS has the same silent drop and mint-on-corrupt (`EventOutbox.swift`, `DeviceKey.swift`) |
| NSD-5 | High | P1-next | Config decoding | One bad `translations` value wipes every translation on iOS; Android drops only that key | **Open · re-graded Medium / P2.** Needs a non-string through two typed schemas and response validation; hardening |
| NSD-6 | High | **P0-now** | Wire contract | Android `products=` encoder saturates integral doubles ≥ 2^63 to `Long.MAX_VALUE` — a wrong value, not a formatting difference | **Open · re-graded Low / P2.** Saturation reproduced (`1e19`), but needs an integral price ≥ 2^63; the Kotlin golden tests this body says are missing exist (`RewardRepositoryTest`) |
| NSD-7 | Medium | P1-next | ABI / packaging | `Composer` is in the frozen ABI dump while Compose is `implementation`-scoped — merchant compile failure | **Open.** Free until the first external consumer |
| NSD-8 | Medium | P1-next | ABI / Java interop | `*Async` `CompletableFuture` twins complete on the main looper; `get()` from Main is a guaranteed ANR | **Open.** Same clock as NSD-7 |
| NSD-9 | Medium | P2-when-picked-up | iOS sheet lifecycle | Install probe can start after `release()` and never stops; unbounded `canOpenURL` poll on MainActor | **Open, changed shape.** `SharingSheetModel` reworked since; the probe now stops itself on detection, still unbounded while the wallet is absent |
| NSD-10 | Medium | P2-when-picked-up | iOS install flow | Store fallback unreachable in the one case that triggers it; `.installStarted` reported when nothing opened | **Open.** Unchanged |
| NSD-11 | Medium | P2-when-picked-up | Privacy / iOS | Sharing WebView uses the app-wide persistent `WKWebsiteDataStore`; nothing ever clears it | **Open.** Unchanged |
| NSD-12 | Medium | P1-next | Test coverage | The entire UIKit half of `FrakSDKUI` is compiled by tests and executed by none | **Open.** Confirmed at HEAD and in `.github/workflows/apps.yaml`; the UIKit surface has grown by four suites since and executes nowhere. Medium: a coverage gap is not itself a defect, and nothing here is reachable damage until one of those suites would have caught something |
| NSD-13 | Medium | P2-when-picked-up | ABI gate | ABI gate is descriptor-only: nullability, equality, failure tier and `@InternalFrakApi` bytecode all pass unnoticed | **Open.** Unchanged |
| NSD-14 | Medium | P1-next | Android lifecycle | `DeepLinkHandling.Automatic` never subscribes `OnNewIntentProvider` for the Activity that initialised the SDK | **Open.** Unchanged |
| NSD-15 | Medium | P2-when-picked-up | Android compose | Empty `onDispose` orphans a live sheet on navigation away from the destination | **Open.** Blocked on the two-destination harness |
| NSD-16 | Medium | P2-when-picked-up | Test coverage | The 67-entry golden rewards corpus is loaded by neither SDK; both loader constants are dead | **Open.** Unchanged |
| NSD-17 | Medium | P1-next | Doc drift | `contract.md` §1.1 documents a `/sharing` param set that no longer exists | **Open.** §1.1 was edited nine times after the audit and every phantom param survived, which says the section is not maintainable by hand — generate it from `SHARING_PARAMS`, special-casing `lng`, which bypasses the table. Medium: the drift misleads an integrator but ships nothing broken |
| NSD-18 | Medium | P1-next | iOS identity | `resetAnonymousId()` doc contradicts shipped behaviour; read-back consults the memo, not the disk | **Open.** Unchanged |
| NSD-19 | Medium | P2-when-picked-up | Wire contract | The `/install` probe fragment is an iOS-only extension of a shared contract, specified nowhere | **Open, widened.** `contract.md` §2 was edited for `clip=host` and the probe fragment is still absent |
| NSD-20 | Medium | P1-next | Config decoding | Android placement tolerance holds only by accident; the next `require*` re-opens the fixed bug | **Open.** Unchanged |
| NSD-21 | Low | P2-when-picked-up | Wire contract | Non-canonical base64url: both natives reject, TypeScript accepts | **Open.** Unchanged |
| NSD-22 | Low | P2-when-picked-up | Both / WebView | `isSameOrigin` treats `https://host` and `https://host:443` as different origins | **Open.** Unchanged |
| NSD-23 | Low | P2-when-picked-up | Android tracking | Custom-payload truncation is nondeterministic (`HashMap` iteration order) and untested | **Open.** iOS `EventQueue` still has no byte cap |
| NSD-24 | Low | P2-when-picked-up | iOS reward decoding | No finiteness guard on reward doubles; Android throws, iOS may surface `±Infinity` | **Open · re-graded Informational.** Refuted on Swift-native Foundation (`1e999` → `dataCorrupted`); unconfirmed only on the iOS 15–17 ObjC path. Add the fixture and close |
| NSD-25 | Low | P2-when-picked-up | Android identity | `IdentityMerge` claim sets are unbounded for the process lifetime | **Open.** iOS has the same unbounded sets (`IdentityMerge.swift`) |
| NSD-26 | Low | P2-when-picked-up | Publishing | The SwiftPM mirror ships a manifest invalid for its own payload | **Open, confirmed.** The staged mirror fails `swift package describe`; two published tags carry it |
| NSD-27 | Low | P2-when-picked-up | Hygiene | Duplicated `MainThreadDispatcher`; history-narrating XML comment; iOS scheme fallback, consent doc, sub-frame log | **Open.** The two dispatchers in (a) have since diverged |

NSD-1a and NSD-1b keep the top of the table for continuity with the previous revision of this report, not because they are the most severe rows in it; both are Medium. Severity is the technical read and is unchanged from the auditors' assessment except for the NSD-1 downgrade recorded above; Priority is the owner's schedule.

## Principal findings — NSD-1a/NSD-1b and the High cluster

### NSD-1a (Medium · P1-next) — Android: the Play Store rung hands the anonymous id and a signed install proof to an unpinned receiver

**Where** `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/InstallLinks.kt:playStore`, `core/DefaultFrakClient.kt:storeUrl` / `openFrakApp` (lines 321–344, 370–380), `applink/AppLauncher.kt:AndroidAppLauncher.open`

**What** `openFrakApp()` mints one `ProofOp.Install` proof and tries a ladder of rungs. The wallet deep link is correctly pinned — `launcher.open(deepLink, settings.env.walletPackageId)` — and `AppLauncher.open`'s own KDoc explains why in as many words:

> `[packageId]` pins the receiver: the wallet handoff must not be answerable by another app that also claims `frakwallet://`, which would silently cost the user their install attribution while this still reports success. **Null for a store URL, where the whole point is to let the device choose.**

The very next statement discards that invariant:

```kotlin
val store = storeUrl(merchantId, anonymousId, proof)
if (launcher.open(store)) OpenAppResult.OpenedStore else OpenAppResult.Failed
```

and `storeUrl` → `InstallLinks.playStore` builds:

```kotlin
val referrer = buildString {
    append("merchantId=").append(merchantId)
    append("&anonymousId=").append(anonymousId)
    if (installProof != null) append("&proof=").append(installProof)
}
return "$PLAY_STORE_BASE?id=$packageId&referrer=${PercentEncoding.encode(referrer)}"
```

That is an unpinned `ACTION_VIEW` on an `https://play.google.com/...` URL carrying the full triple. Any installed app with a matching intent filter — or the default browser, if the chooser resolves there — receives merchant id, anonymous id and the install proof. It fires on exactly the branch where the wallet is *not* installed, which is the acquisition path the proof exists to protect.

**Why it matters** The payload is the complete identity handoff, and the proof binds `(op=install, merchantId, clientId, ts)` to the device key against a window `AppLinkAPI.installPageURL`'s own doc describes as 30 days at the backend. A hostile receiver redeems it and binds this installation to its own wallet: attribution and payout redirected. This is the same class the Android pinning fix closed one branch above it. `open.md` §3 records the iOS half and does not record this Android twin at all.

**Fix** `setPackage("com.android.vending")` on the store intent — Play is the only consumer of an install referrer anyway — and fall back to an unpinned browser open of the *bare* listing URL with the referrer stripped. Play resolves the referrer; a browser cannot use it, so nothing is lost by dropping it. This is the whole fix; there is no design work behind it, which is why it stays scheduled while the iOS arm is accepted.

**Effort** S.

---

### NSD-1b (Medium · **Accepted-risk**) — iOS: the custom-scheme rung is unpinnable, and that is accepted

**Where** `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:openFrakApp` (lines 405–434), `AppLink/InstallLinks.swift:deepLink`, `AppLink/AppLauncher.swift:SystemAppLauncher.open`

**What** Rung 1 is `openUniversalLink` (`.universalLinksOnly: true`, unspoofable). Rung 2 is a bare custom-scheme open with no pinning available:

```swift
let deepLink = InstallLinks.deepLink(
    scheme: settings.env.walletScheme, merchantId: install.merchantId,
    anonymousId: install.anonymousId, installProof: installProof
)
if await launcher.open(deepLink) { return .openedApp }
```

Custom URL schemes on iOS are first-come, not owned. Rung 2 is reached only when rung 1 failed — i.e. when the real wallet is not installed — which is exactly when a squatter wins unopposed. `isFrakAppInstalled()` (`canOpenURL`) cannot tell the wallet from a squatter either, so `.walletOpened` and `SharingSheetModel.onPageAction(.install)`'s early exit both trust it. `open.md` §3 already records "iOS still needs the Universal Link move" for this reason.

**Owner decision: accepted (2026-08-15).** The rationale, recorded as given: exploitation requires a **malicious app already installed on the device** that declares the same custom scheme, i.e. a targeted attack against a user who has already been induced to install the attacker's app — not a drive-by. And the current state is a large net improvement on the previous one, where the handoff carried no signed proof at all; the scheme rung is the only remaining unpinned surface, rung 1 is unspoofable, and closing it properly means shipping universal links, which is a design project rather than a patch. This finding is not scheduled and is not expected to be fixed in its current form.

**Residual risk, concretely.** If it *is* exploited: a squatting app on the same device receives `merchantId`, the user's `anonymousId`, and one `frak-install-v1` proof over `(op=install, merchantId, clientId, ts)` signed by the device key. The proof is accepted by the backend for **up to 30 days** from mint (`AppLinkAPI.installPageURL`'s documented window), and within that window the attacker can redeem it to bind this installation to a wallet of their choosing. The **duration of the loss is not 30 days** — the proof window bounds when the redemption can happen, but the resulting attribution binding is durable, so the referral credit and any payout for that install go to the attacker permanently. The leaked `anonymousId` outlives the proof entirely: it remains valid until the user calls `resetAnonymousId()` or reinstalls, and it is the identity key the rest of the system indexes on. Scope is one device per successful interception; there is no server-side amplification and nothing here exposes the device private key, so the attacker cannot mint *further* proofs.

**Composition with the identity scope (this is the part that changes the arithmetic).** The residual risk above assumes the leaked `anonymousId` is only useful together with the leaked proof. When this was written it was not: **AID-001** and **AID-020** in [`2026-08-15-anonymous-id-proof.md`](./2026-08-15-anonymous-id-proof.md) both let a caller act on an `anonymousId` it holds no key for, so a leaked id was **sufficient on its own** — no proof, no window. **Both are closed as of 2026-08-18**, so this composition no longer applies and the assumption above holds again. The fix is entirely platform-side and is specified in [`../plans/identity-proof-of-possession/README.md`](../plans/identity-proof-of-possession/README.md); no native change is involved, and nothing in this report should be read as describing it.

**Revisit if** universal links are adopted for any other reason (the rung becomes pinnable at no extra cost), or if a scheme-squatting interception is ever observed in the field. Two cheap partial mitigations remain available without the universal-link move and are *not* being taken as part of this acceptance: minting the scheme rung with `installProof: nil` and letting the wallet re-derive after a universal-link open, and gating `.walletOpened` on something stronger than `canOpenURL`.

---

### NSD-2 (High · P0-now) — A failed compaction silently re-delivers the whole backlog, forever

**Where** `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventQueue.kt:reconcile` (lines 351–364), `tracking/EventOutbox.kt:checkpoint` (lines 213–218) and `interactionPayload`'s Arrival arm.

**What** `reconcile` deliberately refuses to compact against a non-durable read — correct, and the reasoning is written down:

```kotlin
val changed = retried.isNotEmpty() || next.size != outcome.events.size
if (outcome.durable && changed) replaceLocked(next)
next
```

But it returns `next` and never reports **whether it wrote**, and the caller clears its accumulators unconditionally:

```kotlin
suspend fun checkpoint() {
    if (delivered.isEmpty() && retried.isEmpty()) return
    queueMutex.withLock { queue.reconcile(delivered.toSet(), retried.toMap(), now()) }
    delivered.clear()
    retried.clear()
}
```

On a full disk or a failed `temp.renameTo(file)`, every row already POSTed stays on disk with its `failures` counter un-incremented. The next `scheduleFlush()` — one per `track`/`purchase`/`trackMerge`, plus every non-null `configStore.updates` emission — re-reads and re-POSTs the entire backlog. Two consequences compound it: `Interaction.arrival` carries **no `idempotencyKey`** (purchases dedupe backend-side on `(orderId, token)`; arrivals dedupe nowhere), and a permanently-`Rejected` row can never reach `MAX_FAILURES = 3` because the increment lives only in the file the disk is refusing. One poison row plus a full disk equals the entire backlog re-POSTed on every merchant `track()` call, indefinitely.

**Why it matters** Full `/data` is routine on low-end devices, and `renameTo` also fails under SELinux and filesystem oddities. The failure is silent past a single `logger.warn` inside `replaceLocked`, and it is on the money path: duplicated arrivals are double-counted attribution.

**Fix** Have `reconcile` return the durability flag; `checkpoint()` retains the accumulators when the write did not land, and `flush` returns early — arming the backoff — after N consecutive non-durable reconciles. Independently, give `arrival` an `idempotencyKey` on the wire; that is a wire-format addition and it is far cheaper now than once merchants have rows on disk.

**Effort** S for the durability plumbing; M for the wire addition (needs the backend and both platforms).

---

### NSD-3 (High · P0-now) — iOS drains the entire backlog before reconciling; Android checkpoints every 20 rows

**Where** `sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift:drain` (single `await queue.reconcile(...)` at line 341, after the loop) vs `sdk/android/.../tracking/EventOutbox.kt:flush` → `checkpoint()` with `RECONCILE_EVERY = 20`.

**What** Android flushes the accumulator to disk every 20 delivered/retried rows, and says why:

> A kill mid-drain replays whatever this pass has sent but not yet written down, so the accumulator is checkpointed rather than held for the whole backlog.

iOS has no equivalent: `delivered` and `retried` are locals that only reach the file after `eventLoop` completes. A process kill — or a jetsam while suspended — after N successful POSTs leaves all N rows on disk to be re-sent next launch. With `maxEvents = 1000`, the replay window is 50× Android's.

**Why it matters** iOS's own code names the consequence, in `drain()`'s consent-withdrawal comment: *"`Interaction.arrival` carries no idempotency key — a duplicated referral payout."* `arrival` is exactly the row this replays. This is single-platform attribution duplication in the path that mints money, and it is the same underlying exposure as NSD-2 reached by a different route.

**Fix** Port `checkpoint()`: reconcile every 20 rows inside `eventLoop`, then the final reconcile. Roughly ten lines, and `EventOutboxTest` on Android has a test shape to copy.

**Effort** S.

---

### NSD-4 (High · P0-now) — Queued events dropped on a client-id change with no log, including on a spontaneous keystore rotation

**Where** `sdk/android/.../tracking/EventOutbox.kt:flush` lines 228–232; `identity/AndroidKeystoreDeviceKeyStore.kt:load`/`loadOrCreate`.

**What** The drain discards a row whose captured `clientId` no longer matches, silently:

```kotlin
// Dropped even if purge and this drain raced: event carries the id it was captured under.
if (event.clientId != null && currentClientId != null && event.clientId != currentClientId) {
    delivered += event.rowId
    continue
}
```

Every other drop in this file logs — `logger.info("Tracking was disabled mid-drain…")` two lines above, `logger.warn("No sender registered for row kind…")` four lines below. This one does not. The intended trigger is `resetAnonymousId()`, where the drop is correct and deliberate. But `AndroidKeystoreDeviceKeyStore.load()` returns `null` for a **damaged** entry as well as an absent one, and `loadOrCreate()`'s `?:` then runs `create()` against the same alias — minting a new keypair, hence a new `clientId`, with no signal. Every queued purchase captured under the old id is then discarded invisibly on the next drain.

**Why it matters** Money path with zero observability. A merchant seeing a gap in purchase attribution has no logcat line, no `FrakLogSink` call and no metric to find it by. `open.md` §8.5 already records that `AndroidKeystoreDeviceKeyStore` has zero test references and is untestable on the JVM — which is precisely the path that converts "damaged entry" into "silent identity rotation".

**Fix** Log the drop at `warn` with row kind and count. Separately, split `load()`'s two null causes so an entry that exists but fails to load is reported — and ideally counted — before `create()` overwrites it.

**Effort** S for the log; M to split the load failure modes safely.

---

### NSD-5 (High · P1-next) — One bad `translations` value wipes every translation on iOS

**Where** `sdk/ios/Sources/FrakSDK/Config/ResolvedConfigDecoder.swift:49` (`SdkConfigWire.init`) and `:113` (`PlacementWire.init`); Android twin `net/JsonReader.kt:stringMap`.

**What** This is the exact failure mode commit `77a6b4c95` fixed for `placements` — and the file documents that fix immediately below the unfixed line:

> `try? container.decodeIfPresent([String: PlacementWire].self, ...)` looked like the same tolerance as every field above, but Swift's synthesized dictionary decoding fails wholesale the moment one value in the dictionary throws — one malformed placement was silently discarding every good one. Android's twin, `net/JsonReader.kt`'s `objectMap`, walks the JSONObject's keys and skips only the entry that fails to parse.

The remedy became `decodePlacements`, a nested-container walk. `translations`, one field above it, still reads:

```swift
translations: (try? container.decodeIfPresent([String: String].self, forKey: .translations)) ?? [:],
```

and the identical line survives in `PlacementWire`. Android's `stringMap` is per-entry (`mapNotNull { (nested.opt(entryKey) as? String)?.let { ... } }`), so it drops only the offending key.

**Why it matters** The resolve response carries merchant-authored copy. A single non-string value — a number, a null, or a tiered `{en:{…}}` blob leaking through the flattening in `MerchantResolveService` — makes the iOS sheet fall back to default strings for **every** label while Android renders all-but-one. Silent, per-platform, invisible in logs, and it re-opens a bug the codebase already paid to fix and documented.

**Fix** Decode `translations` through the same nested-container walk (or a shared `forgivingStringMap`), in both `SdkConfigWire` and `PlacementWire`. Add a fixture with one non-string translation on both platforms.

**Effort** S.

---

### NSD-6 (High · P0-now) — Android's `products=` encoder saturates large integral prices to `Long.MAX_VALUE`

**Where** `sdk/android/.../rewards/RewardRepository.kt:jsonNumber` (lines 263–270) vs `sdk/ios/Sources/FrakSDK/Rewards/ProductDetailsQueryEncoder.swift:jsonNumber` (lines 75–81).

**What** Android:

```kotlin
private fun Double.jsonNumber(): String =
    if (this == Math.floor(this) && !isInfinite()) { toLong().toString() } else { toString() }
```

Narrowing `double`→`long` in Java/Kotlin **saturates** rather than overflowing. Reproduced against the exact algorithm:

| Input | Android emits | iOS / `JSON.stringify` |
|---|---|---|
| `1e30` | `9223372036854775807` | `1e+30` |
| `1e19` | `9223372036854775807` | `1e+19` |
| `12345678.9` | `1.23456789E7` | `12345678.9` |
| `123456789.0` | `123456789` | `123456789` |

Two distinct defects. The saturation sends a **wrong value** to the backend's product-scope matcher, not merely different bytes. Separately, Java's `Double.toString` switches to exponent form at 1e7 where Swift's `description` and `JSON.stringify` do not, so the two platforms do not produce byte-identical `products=` for prices ≥ 1e7 — which also means they compute **different reward-cache keys**, since `cacheKey` embeds `encodedProducts`.

**Why it matters** The encoder's stated reason for existing is to be identical to `sdk/core`'s `compressJsonToB64`; the comment directly above the defect asserts "the golden vectors and every sibling-platform decoder assert on this". Neither claim holds, and nothing catches it — `ProductDetailsQueryEncoderTests.swift` has no Kotlin peer asserting the same strings (see NSD-16).

**Fix** Use the integral path only when the value fits a `Long`, and fall back to `toString()` otherwise; then reconcile the exponent-form threshold against `JSON.stringify`. Add a golden vector file for `products=` so both platforms assert identical strings.

**Effort** S for the saturation guard; M to reconcile formatting and add cross-platform vectors.

## Medium findings

**NSD-7 — `Composer` is public ABI while Compose is `implementation`-scoped.** `frak-sdk-ui/api/frak-sdk-ui.api:11` freezes `public final fun build (Landroidx/compose/runtime/Composer;I)Lid/frak/sdk/ui/FrakSharing;`, but `build.gradle.kts` declares `implementation(platform(libs.compose.bom))` / `implementation(libs.compose.ui)` while `androidx.activity` was correctly promoted to `api(libs.androidx.activity)` for `ComponentActivity`. A consumer's POM therefore omits Compose, and the merchant hits it at *their* first build. Nothing consumes the published artifact yet, so it is free to fix now; after the first integration either promotion or removal is a break. Fix: `api(libs.compose.runtime)` at minimum, or split the Compose entry point into a third artifact.

**NSD-8 — `*Async` twins complete on the main looper.** `DefaultFrakClient.asFuture` uses `scope.future(mainDispatcher, CoroutineStart.UNDISPATCHED)`, asserted by `AsyncTwinTest` ("completion must be signalled from the main dispatcher"). All 17 `CompletableFuture` entries in the dump can therefore only complete via a main-looper turn, so the most obvious thing a Java merchant writes — `client.anonymousIdAsync().get()` on the UI thread — deadlocks into an ANR. The hazard is documented in KDoc twice and enforced nowhere. `CompletableFuture` is a blocking-capable type; handing out one that cannot be blocked on from the thread merchants will use it from is a foot-gun frozen into the ABI. Fix before 1.0.0: complete on a default executor and let callers hop, or ship `…Callback(onResult, onError)` overloads instead.

**NSD-9 — iOS install probe can start after teardown and never stops.** In `SharingSheetModel.onPageAction(.install)` the `Task` awaits `installPageURL(...)`, a network round trip the code itself concedes "a user can swipe straight through". `SharingPresentation.dispose()` → `release()` → `installProbe?.stop()` can run during that await; when the Task resumes it calls `installProbeURL`, which calls `installProbe.start(...)` unconditionally, consulting neither `closed` nor `webView`. The probe then polls on a released model and cannot terminate itself: `didDetectInstall` opens with `guard showingInstallPage, self.sessionId == sessionId, let webView, let installProofURL else { return }` — `webView` is nil after `release()` — and returns **before** any `stop()`, while `InstallProbeSchedule` has no ceiling by design. It dies only when the next `launch` or `teardown()` deallocates the model. Cost: an unbounded `canOpenURL` poll on the MainActor for the remaining life of the merchant's screen, plus a retained sheet model, store invite and leaked `NotificationCenter` token. Fix: re-check `guard !closed, webView != nil` after each await, and call `installProbe?.stop()` on `didDetectInstall`'s early returns.

**NSD-10 — The store fallback cannot fire in the one case that triggers it.** `onPageAction(.install)`'s guard comments "Nothing to build an install page from; the store handoff closes the sheet" and falls through to `_ = await openFrakApp()`. But `openFrakApp()` opens with `guard let install = try? await merchantIdentity.pair(.optional) else { return .failed }`, and `pair` returns nil precisely when `identity.anonymousId()` is nil — the same missing identity that made `installPageURL` throw. So the chain collapses: no install page, no deep link, and `InstallLinks.appStore()` is never reached. The sheet calls `close()` and reports `.installStarted`, whose public doc promises "…the sheet took them to the wallet's install page (**or, with no identity to hand it, to the store**)" and whose `significance` of 3 outranks `.shared`. The user taps Install, the sheet vanishes, nothing opens, and the merchant is told an install started. Narrow trigger (consent withdrawn mid-sheet, enclave refusal) but silent and wrongly reported. Fix: move `launcher.open(InstallLinks.appStore())` above the `pair` guard so the store rung is identity-free.

**NSD-11 — The sharing WebView writes to the app-wide persistent data store.** `SharingWebView.swift:124` sets `configuration.websiteDataStore = .default()`, so wallet-origin cookies, localStorage, IndexedDB and HTTP cache land in the merchant app's container, shared with any other `WKWebView` the merchant owns, persisting across sheets and launches. Grep confirms no `removeData` call anywhere in `Sources/FrakSDKUI`; `destroy()` only drops the delegate and stops loading, and `resetAnonymousId()` lives in the core with no reach into the UI module, so any identity the page persisted client-side survives a merchant-driven reset. The file also contradicts itself: the store is justified as "the hosted page's own HTTP cache is what tier 2 falls back on" while `handleMainFrameFailure` states "the hosted document is served `no-store`, so it is never in the HTTP cache". Fix: `.nonPersistent()` plus explicit subresource warm-up, or keep `.default()` and add a purge to `SharingWebViewPool.destroy()` and to a hook the core can call on reset/withdrawal.

**NSD-12 — The UIKit half of `FrakSDKUI` is compiled by tests and executed by none.** `scripts/run.sh:do_test` builds tests at an iOS-simulator triple, then runs `swift test` on the **host**, where `#if canImport(UIKit)` is false. `SharingSheetModel` (the tier-1/2/3 state machine, `claimed` guards, deadline, install flow, `didDetectInstall`), `SharingWebView`, `SharingWebViewPool`, `SharingPresentation`/`SharingPresenter`, `NativeShare`, all three `StoreInvite`s, `InstallProbe` and `FrakSharing` have zero executed assertions; two test files say so in their own headers. What runs is only the pure logic already factored out (`sharingDecision`, `sharingReclaim`, `SharingPageURL`, `SharingResult`, `InstallProbeSchedule`, `clampedSharingHeightFraction`). That NSD-9 and NSD-10 both live in unreachable code is not a coincidence. Fix: an `xcodebuild test -destination 'platform=iOS Simulator'` job — the deferred work `do_test`'s own comment names.

**NSD-13 — The ABI gate is descriptor-only.** Four classes of change pass `apiCheck` green, verified by reading the dumps against source. (1) *Nullability*: `AttributionParams.getRef ()Ljava/lang/String;` is identical whether the Kotlin type is `String` or `String?`; flipping any of ~40 nullable getters is a Kotlin source break and invisible. (2) *Equality*: `FrakConfig`, `FrakMetadata`, `SharingProduct`, `SharingRequest` and the `SharingResult` arms have no `equals`/`hashCode` in the dump while `AttributionParams`, `ProductDetails`, `RewardRequest`, `Interaction` do; adding equality later changes behaviour with an unchanged descriptor. (3) *Failure tier*: `FrakClient`'s own KDoc concedes "A tier change is invisible to the ABI dump, so it needs a `!` commit." (4) *`@InternalFrakApi` members are real public bytecode* — `FrakSdkVersion.HEADER_NAME`, `PercentEncoding` and every reward-model constructor are `public` and excluded from the dump via `nonPublicMarkers`; `@RequiresOptIn` is a Kotlin-only compiler check, so a Java merchant calls `FrakSdkVersion.getHEADER_NAME()` with no friction and no gate notices when it changes. Also a doc contradiction: the root `build.gradle.kts` says a member-level marker "needs PROPERTY/FUNCTION, not just CLASS" while `README.md:290` calls `@Target(CLASS)` load-bearing; `InternalFrakApi.kt` targets `CLASS, PROPERTY, FUNCTION, CONSTRUCTOR`, so the README is wrong.

**NSD-14 — `DeepLinkHandling.Automatic` misses the Activity that initialised the SDK.** `DeepLinkObserver.subscribeToNewIntents` is reached only from `onActivityCreated` (line 28); `onActivityStarted` is `= Unit`. `Application.dispatchActivityCreated` fires from inside `super.onCreate()`, so a merchant calling `Frak.initialize` from an Activity's `onCreate` registers the callbacks *after* that Activity's created-event has dispatched — the `OnNewIntentProvider` subscription never happens for that Activity, silently, for the process lifetime. Warm-start referrals then depend entirely on the merchant having followed the `setIntent(intent)` note at `README.md:40`, which is the requirement the `OnNewIntentProvider` path exists to backstop. Fix: also subscribe from `onActivityStarted` (the `listeners.containsKey` guard is already idempotent), or log an error when `initialize` receives an Activity context with `deepLink == Automatic`.

**NSD-15 — Empty `onDispose` orphans a live sheet.** `FrakSharing.Builder.build()`'s `@Composable` overload runs `DisposableEffect(host, stable) { host.attach(activity, stable); onDispose { } }`. With Compose Navigation, leaving the destination disposes the composition but detaches nothing: `SharingHost` is `ViewModelStore`-scoped to the Activity, so `live`, `pool` and `dialog` survive, the sheet stays on screen over the new destination, and `onResult` fires into a dead composition through the `rememberUpdatedState` trampoline. The single-screen harness cannot reproduce it. The naive `onDispose { host.dismiss() }` reintroduces the opposite bug, so the tractable step is the one `open.md` §3.6 already names — a two-destination `NavHost` in the harness — and, immediately, a warning under the README's Compose snippet, which currently says nothing.

**NSD-16 — The golden rewards corpus is dead on both platforms.** `sdk/core/src/rewards/fixtures/golden-rewards.json` holds 67 entries; `GoldenFixtures.REWARDS` (Kotlin) and `GoldenFixtures.rewards` (Swift) are declared and referenced by no test. Grep confirms both platforms load only `IDENTITY_PROOFS`/`identityProofs` and `CONTEXT_CODEC`/`contextCodec`; reward decoding is asserted against hand-written literals. Worth stating precisely, because the gap is differently shaped than `contract.md` §4.5 implies: neither SDK formats currency at all (both send `formatted=1` and read `best.formatted`), so the *formatting* half of the corpus has no native consumer — but the decode half, including the new `Unknown` tier arm, could be pinned and is not. NSD-6 and NSD-24 are exactly what such a suite would have caught. Fix: add a decode-conformance suite over the reward shapes on both platforms, or delete the two constants and downgrade the corpus to a TS-only artifact in the doc.

**NSD-17 — `contract.md` §1.1 documents a `/sharing` param set that no longer exists.** The doc names `native=1`, `preload=1`, `confirmed=1`, `r=`, `sdkv=` and an `attribution` param. `apps/wallet/app/module/sharing/params/table.ts:SHARING_PARAMS` declares `merchantId, clientId, link, appName, logoUrl, products, checkoutToken, redirectUrl, embed, returnScheme, sid, sdkVersion, seedReward, state, view` — no `attribution`, no `native`, no `preload`, no `confirmed`, no `sdkv`. Both SDKs agree with the tree; only the doc is wrong. Consequently "Trap 2 — `attribution=null` is not the same as omitting it" is unactionable advice about a param that cannot be sent, and §5's "`native=1` footer ownership" open item names a marker that no longer exists. This file is described as the one spec spanning `apps/wallet`, `services/backend` and both SDKs, so a third implementer would ship a page URL the router silently drops — unknown params are ignored, so the failure is a blank sheet with no error. Fix: regenerate §1.1 from `SHARING_PARAMS` (a test could dump it), restate Trap 2 against `AttributionParams`, and restate the footer item in terms of `embed=native`.

**NSD-18 — `resetAnonymousId()`'s doc contradicts the shipped behaviour, and the read-back is memo-based.** `FrakClient.swift:40-42` still tells merchants "On this platform the underlying delete cannot fail, so this always returns true — the value exists to keep one cross-platform contract", while `CHANGELOG.md` `[1.0.0-beta.2] → Fixed` records that the unconditional `true` was removed and `PersistedDeviceKeyStore.delete()` now verifies. Separately the verification is weaker than it reads: `delete()` checks `store.string(forKey:) == nil`, which goes through `loaded()` and returns the in-memory `values` memo. `FileKeyValueStore.write()` catches its own failure and only logs, and `removeValue`'s unreadable branch does `try? FileManager.default.removeItem(...)` then `values = nil` — so on a failed removal or a failed write the memo says "gone" while the key is still on disk, and `delete()` returns `true`. (Note: the store's unreadable path deletes the whole file and is more careful than it first appears; the defect is the discarded `try?`/`write` failure, not the unreadable branch.) A merchant wiring a GDPR flow off the boolean is told the identity rotated when it did not. Fix: delete the stale sentence, and have `delete()`/`write()` propagate the I/O failure.

**NSD-19 — The `/install` probe fragment is an undocumented iOS-only extension.** `SharingPageURL.installPageProbed` / `installDetectedFragment` / `InstallSurface`, `InstallProbe` and `InstallProbeSchedule` append `sid`/`probe` to the install fragment and rewrite it with `installed=1&dt=…&via=…` on detection; `apps/wallet/app/module/install/params/table.ts` has a param table, four analytics events and tests for those keys. Android's `InstallLinks.installPage` emits only `embed/m/a/returnScheme/sid` and never rewrites, and nothing appears in `contract.md` §2 or `decisions.md` §6. A live four-key wire contract with one producer and no spec: nobody can tell whether Android is missing a feature or the wallet is carrying dead params, a rename of `probe` would be reviewed as web-only and break iOS, and `install_detected` funnel data exists for iOS users only. Fix: add the fragment table to `contract.md` §2 and record why Android does not need it (Play install referrer carries identity, which iOS lacks) — or file it as an Android gap.

**NSD-20 — Android's placement tolerance holds only by accident.** `JsonReader.objectMap` is `mapNotNull { (nested.opt(entryKey) as? JSONObject)?.let { entryKey to transform(it) } }` — no `runCatching`. It skips entries that are *not objects*; an exception thrown inside `transform` propagates and fails the whole `merchant/resolve` decode. Today `decodePlacement` uses only non-throwing accessors, so the platforms happen to match. The moment anyone adds a `requireString`/`requireFiniteDouble` — the natural move when a placement field becomes mandatory — Android goes from "drop one placement" to "no config at all", the exact regression `77a6b4c95` closed on iOS. No test pins the per-entry guarantee on Android, and the iOS comment's claim that `objectMap` "skips only the entry that fails to parse" is not what the code does. Fix: wrap `transform` in `runCatching { … }.getOrNull()`, correct the iOS comment, add the malformed-placement case to `ResolvedConfigDecoderTest.kt`.

## Low findings

**NSD-21 — Non-canonical base64url diverges.** `Base64Url.kt` rejects non-zero trailing bits and `Base64URL.swift` round-trip-checks, while `sdk/core/src/utils/compression/b64.ts` uses bare `atob`, which drops them. An `fCtx` mangled in transit attributes on web and silently loses attribution in-app. No fixture covers it — `reject-decompress-valid-b64-wrong-length` uses `AAAAAAAAAAA`, whose leftover bits are zero. Add a `reject-decompress-noncanonical-tail` fixture and make `base64urlDecode` strict so all three agree.

**NSD-22 — Default ports break the origin check on both platforms.** `SharingWebView.kt:isSameOrigin` compares `url.port == origin.port` where `Uri.getPort()` is `-1` when unspecified, and `SharingWebView.swift:isSameOrigin` does the same; a wallet-origin page emitting `https://wallet.frak.id:443/…` is classified cross-origin and punted out of the sheet to a browser. Also affects `FrakEnvironment.Custom` where merchant and page spell the origin differently. Normalise `-1` to 443/80 by scheme.

**NSD-23 — Custom-payload truncation is nondeterministic and untested.** `EventOutbox.interactionPayload` does `kind.data.entries.take(MAX_CUSTOM_ENTRIES)` over a merchant-supplied `Map<String, String>`; for a `HashMap` the iteration order is unspecified, so *which* 32 of 40 entries survive is not reproducible, while the `logger.warn` says "only the first $MAX_CUSTOM_ENTRIES are queued" — implying an order the type does not guarantee. Neither `MAX_CUSTOM_ENTRIES`/`MAX_CUSTOM_FIELD_LENGTH` nor `EventQueue.MAX_BYTES`/`withinByteBudget` has a single test reference, despite being the two paths that silently discard merchant data. Sort before `take`, correct the message, add two pure-JVM tests. Related: iOS applies no custom-payload bounds at all (`interactionBody` writes `"data": data` verbatim) and `EventQueue.swift` has no byte cap, so identical merchant input produces different wire bytes per platform and the iOS queue file is unbounded.

**NSD-24 — No finiteness guard on iOS reward doubles.** `JsonReader.kt:requireFiniteDouble` exists explicitly because "`org.json` accepts `NaN`/`Infinity`, and `1e999` becomes `Infinity`"; `RewardsDecoder.swift` uses `container.decode(Double.self)` / `decodeForgiving` with a default `JSONDecoder` and no such check. For a body with `1e999` in `amount`/`minValue`/`unitPrice`, Android raises `FrakError.Decoding` while iOS appears to bind `Double.infinity` and hand it to the caller. Not executed here — Foundation's out-of-range literal behaviour on the current toolchain is unconfirmed — so verify with a one-line test on both, then add an `isFinite` guard or document the difference.

**NSD-25 — `IdentityMerge` claim sets are unbounded.** `consumed` and `arrivals` are plain `mutableSetOf<String>()` on an object living as long as the client, so every distinct `fmt` token and every raw `fCtx` surviving the arrival guard is retained for the process lifetime, with no cap and no sweep. Bounded in practice by how many links reach the app. Use a bounded LRU.

**NSD-26 — The SwiftPM mirror ships a manifest invalid for its payload.** `do_mirror_stage` deliberately omits `Tests/`, while the published `Package.swift` still declares two `.testTarget`s with `path: "Tests/…"`. Harmless for a consumer — SwiftPM does not validate a dependency's test-target paths — but the mirror repo is un-buildable in place (`invalid custom path 'Tests/FrakSDKTests'`), which bites a merchant who clones it to debug or vendors it as a local path dependency, and it rests on an undocumented leniency a future toolchain may tighten. Conditionalise the test targets behind an env var so the mirrored manifest declares only the two libraries.

**NSD-27 — Hygiene cluster.** (a) `MainThreadDispatcher` exists verbatim twice, in `frak-sdk/core/` and at the bottom of `frak-sdk-ui/SharingHost.kt`; promote the core one to `@InternalFrakApi public` and delete the copy. (b) `frak-sdk/src/main/AndroidManifest.xml` narrates history ("It used to ship `frak_data_extraction_rules.xml` … both were removed because…"), which the root `AGENTS.md` bans; `scripts/check-comments.ts` globs only `.kt`/`.swift`, so XML escapes the gate. (c) iOS falls back to a shared `frak-app` return scheme when `Bundle.main.bundleIdentifier` is nil; not an interception hole, since the navigation is intercepted inside the SDK's own `WKWebView`, but worth a warning at `initialize`. (d) `TrackingConsent`'s doc says consent is "Stored in the identity `KeyValueStore` suite", but `Frak.initialize` passes `UserDefaultsStore(suiteName: .consentSuiteName)` (`id.frak.sdk.consent`) while identity is now `FileKeyValueStore` — a load-bearing distinction, since consent must survive a restore and identity must not. (e) Android cross-origin sub-frame navigations are cancelled with no log even in a debuggable build; and where iOS explicitly cancels a sub-frame `returnScheme` navigation, Android relies on `WebView` not starting Activities for unhandled schemes — same net behaviour, invariant stated on only one platform.

## What is solid

- **The durable outbox is the strongest code in either SDK.** `EventOutbox.flush`'s break-vs-continue discipline is correct and each arm justifies its choice where it is made; the `Hold` budget's never-cleared `heldSince` measures total time stuck rather than time-since-last, which is the right semantics; `RECONCILE_EVERY` bounds duplicate replay to 20 rows. `EventOutboxTest`/`EventQueueTest` cover ~60 named behaviours including migration, torn tails, non-durable rewrites, per-kind hold budgets and consent withdrawal mid-drain.
- **`ReadOutcome.durable` is genuinely good design** — reporting out-of-band that "the ids I just assigned exist nowhere but this call stack" so `reconcile` can refuse to compact against it is a failure mode most queues get wrong. NSD-2 is that the flag stops one layer short of its caller; the mechanism itself is right.
- **WebView security posture, Android.** No `addJavascriptInterface` anywhere, `allowFileAccess=false`, `allowContentAccess=false`, `MIXED_CONTENT_NEVER_ALLOW`, multiple windows off, geolocation off, third-party cookies off, component-by-component origin comparison with an explicit note about the `wallet.frak.id.attacker.example` prefix attack, cross-origin sub-frames cancelled outright, `setWebContentsDebuggingEnabled` gated on the host's `FLAG_DEBUGGABLE`, and `onRenderProcessGone` returning `true` with a comment explaining that `false` kills the host app.
- **No JavaScript bridge on iOS at all.** No `WKScriptMessageHandler`, no `userContentController`, no `evaluateJavaScript`; the page's only channel back is an intercepted `returnScheme://result` navigation gated on a per-session UUID `sid` and cancelled in sub-frames. The right shape, implemented consistently.
- **iOS identity storage is deliberately not the Keychain, and the reasoning holds end to end.** `PersistedDeviceKeyStore` keeps a Secure-Enclave-wrapped blob (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, `.privateKeyUsage`, no biometry gate) in a backup-excluded directory with `FileProtectionType.completeUntilFirstUserAuthentication` re-applied after every atomic write; device restore yields a new identity by construction, and `loadOrCreate` refuses to mint over an unreadable store rather than orphaning a healthy id — the `read()` → `fileReadNoPermission` → `nil` path is exactly right and well commented.
- **`AnonymousIdStore`'s single-flight (Android).** `await()` outside the mutex, `generation` cleared only on `===` identity so a concurrent `reset()` is not clobbered, refusals never cached, `coroutineContext.ensureActive()` to distinguish a cancelled shared `Deferred` from a dead caller job. The hardest concurrency in the module, and it reads correct.
- **iOS concurrency annotations are honest.** Every `@unchecked Sendable` in `Sources/**` is lock-guarded or immutable, both `nonisolated(unsafe)` statics sit behind `NSLock`, and `Frak.takeForShutdown()` hoists the critical section so no lock spans a suspension.
- **`SharingHost` rotation handling (Android).** `MutableContextWrapper` swapped in `attach`/`onDestroy` so a retained `WebView` never pins a dead Activity; `pendingResult` buffered and replayed through a `post` that re-reads rather than captures; `isChangingConfigurations` used to drop the callback before a post-`onSaveInstanceState` delivery.
- **Codec and proof parity is real and enforced.** Both platforms execute the full context and identity-proof corpora in both directions and assert the entry count did not shrink; `ProofCodecTest`/`ProofCodecTests` additionally assert `covered == {install, merge}`, so a new op with no fixture cannot ship unasserted. The error taxonomy is a true 1:1 across 9 kinds, and the backoff ladder constants match exactly.
- **Publish/ABI plumbing.** `checkCentralBundle` guards the one real failure mode (`signing.isRequired = signingKey != null` silently producing an unsigned bundle); the `strictly` constraint pinning `:ui` → `:core` because of invisible `@InternalFrakApi` coupling is a genuine trap correctly handled; both `consumer-rules.pro` files explain why they are empty and forbid the blanket `-keep`, which with the harness's minified `release` variant is a reproducible R8 story.
- **Version discipline works.** `bun run check:native-versions` passes: Android 1.0.0-beta.2 across 5 sites, iOS across 3, both with CHANGELOG sections. `bun run lint:comments` is clean across 282 files.

## Test and coverage assessment

| Surface | Appears covered | Actually proves |
|---|---|---|
| Android outbox/queue | ~60 named JVM tests | Genuine: migration, torn tails, non-durable rewrite, hold budgets, mid-drain withdrawal. The best-tested code in either SDK |
| Android byte budget / custom-payload caps | `MAX_BYTES`, `MAX_CUSTOM_ENTRIES` exist | Nothing — zero test references to either constant (NSD-23) |
| `AndroidKeystoreDeviceKeyStore` | — | Nothing; no `AndroidKeyStore` provider on the JVM, untestable there by construction (`open.md` §8.5), and it is the NSD-4 trigger |
| iOS sheet, WebView, pool, probe, presenter | Two test files exist | Nothing executed — host-stage `swift test` skips everything behind `#if canImport(UIKit)` (NSD-12). NSD-9 and NSD-10 both live here |
| iOS pure logic | `sharingDecision`, `SharingPageURL`, `InstallProbeSchedule`, `SharingResult` | Genuine, and the factoring is what makes the rest tractable to fix |
| Context + proof codecs | Golden corpora, both platforms | Genuine and enforced, including a count-shrink guard and op coverage |
| Reward decode/format | 67-entry golden corpus committed | Nothing — loaded by neither SDK; both constants dead (NSD-16). NSD-6/NSD-24 are what it would have caught |
| `products=` encoder | `ProductDetailsQueryEncoderTests.swift` | iOS only; no Kotlin peer asserts the same strings, so NSD-6 was invisible |
| Placement/translation tolerance | iOS `decodePlacements` fixed and commented | Only `placements`, only iOS; `translations` unfixed (NSD-5), Android's per-entry behaviour unpinned (NSD-20) |
| CI | `.github/workflows/apps.yaml` on every touching push/PR | Compile + JVM/host tests + ktlint + ABI gate + Android Lint. No emulator, no simulator, no device |

Two structural points. First, the ABI gate (NSD-13) is the same shape of problem as the test gaps: it checks descriptors, so it protects against the changes least likely to be made carelessly and not against nullability, equality or failure-tier flips. Second, the harness is a single screen, which is why NSD-15 (multi-destination `NavHost`) cannot surface there — the plan already names the fix.

*Local environment caveat:* `node_modules` on this checkout is broken (`react` not hoisted; `bun.lock` locally rewritten with `verdaccio` URLs), so React/DOM suites fail with `React.act is not a function`. That is a local artifact, not a finding — pure-logic suites run clean (`sdk/core/src/rewards`: 167/167 passing). Kotlin and Swift toolchains were unavailable, so no native suite was executed; `bun run lint:comments` and `bun run check:native-versions` were run and both pass.

## Doc drift

| Doc claim | Location | Reality |
|---|---|---|
| `/sharing` takes `native=1`, `preload=1`, `confirmed=1`, `r=`, `sdkv=`, `attribution` | `contract.md` §1.1 | `SHARING_PARAMS` declares `embed`, `state=warm\|live`, `view=confirmation`, `seedReward`, `sdkVersion`; **no `attribution` param exists** (NSD-17) |
| "Trap 2 — `attribution=null` is not the same as omitting it" | `contract.md` §1.1 | Unactionable; the param cannot be sent |
| "`native=1` footer ownership" open item | `contract.md` §5 | Names a marker that no longer exists; the live concern is `embed=native` |
| `FrakSdkVersion.kt`'s KDoc points at a `version` in `build.gradle.kts` that does not exist | `open.md` §5 | Closed. Reads "Keep in step with `frak.sdk.version` in `gradle.properties`; the build checks it", enforced by `checkSdkVersionMatchesArtifact` |
| S11 "fails closed only incidentally, because `anonymousId()` returns null" | `open.md` §3 | Not incidental: `buildSharingLink`'s first statement is `requireTrackingEnabled()`, preserved through `SharingSessionBuilder.build` to `SharingResult.Failed`. Rest of S11 (clientId in query string, UI module never reading `TrackingConsent`) is accurate |
| §2.3 "`Frak.shutdown()` leaves stale listeners, so re-initialising double-tracks" | `open.md` §4 | Closed. `Frak.Session.observer` retains the pair and `shutdown()` calls `unregisterActivityLifecycleCallbacks`. Residual per-Activity `OnNewIntentListener`s route through a null `session?.core` and report nowhere |
| `1.0.0-beta.1` is the published version | `open.md` §1 | Both platforms are at `1.0.0-beta.2` (`gradle.properties`, `FrakSdkVersion.CURRENT`, `FrakSDKVersion.current`) |
| "Android's `objectMap` skips only the entry that fails to parse" | `ResolvedConfigDecoder.swift` comment | Skips non-objects; a `transform` throw propagates and fails the whole decode (NSD-20) |
| `README.md:290` "`@Target(CLASS)` on that annotation is load-bearing" | `sdk/android/README.md` | `InternalFrakApi.kt` targets `CLASS, PROPERTY, FUNCTION, CONSTRUCTOR`; root `build.gradle.kts` says the opposite |
| "On this platform the underlying delete cannot fail, so this always returns true" | `FrakClient.swift:40` | Contradicted by the beta.2 fix and by `PersistedDeviceKeyStore.delete()`'s own read-back (NSD-18) |
| "the hosted page's own HTTP cache is what tier 2 falls back on" | `SharingWebView.swift:124` | Same file's `handleMainFrameFailure` says the document is served `no-store` and is never cached (NSD-11) |
| `.installStarted` "or, with no identity to hand it, to the store" | `SharingResult.swift:7-9` | The store rung is unreachable in exactly that case (NSD-10) |
| "the golden vectors and every sibling-platform decoder assert on this" | `RewardRepository.kt:261` | No golden vectors for `products=`; the rewards corpus is loaded by neither SDK (NSD-6, NSD-16) |
| `/install` probe fragment (`probe`/`installed`/`dt`/`via`) | absent from `contract.md` §2, `decisions.md` §6 | Live four-key contract with one producer (iOS) and a full wallet-side param table (NSD-19) |

## Recommended next actions

Ordered by the priorities in [Owner decisions applied](#owner-decisions-applied-2026-08-15): the money path and the wire-value defect lead, the Android install-handoff one-liner follows, and the iOS half of the old item 1 is gone because it is accepted.

1. **Make the reconcile durability flag reach its caller, and port `checkpoint()` to iOS.** Retain accumulators on a non-durable write, arm the backoff after N failures, reconcile every 20 rows inside iOS's `eventLoop`. Closes NSD-2, NSD-3. **S**
2. **Log the client-id drop, and give `arrival` an idempotency key.** The log is one line; the wire field is the durable fix for replay double-counting and is the reason NSD-2/NSD-3 are money-path rather than bandwidth findings — cheapest before merchants have rows on disk. Closes NSD-4, halves NSD-2/NSD-3 impact. **S** then **M**
3. **Guard the `products=` integral path and add cross-platform vectors.** The saturation is a wrong value on the wire, not a formatting difference; the guard is the fits-in-a-`Long` check. Closes NSD-6, and gives NSD-16 its first real consumer. **S** for the guard, **M** with vectors.
4. **Pin the Android install handoff.** `setPackage("com.android.vending")` on the store intent and drop the referrer from the browser fallback. Closes NSD-1a. The iOS half of this item — pinning or de-proofing the custom-scheme rung — is **dropped: NSD-1b is an accepted risk**, and the compensating work lives in the identity scope (AID-001). **S**
5. **Fix `translations` decoding on iOS and guard `objectMap` on Android.** Same nested-container walk in both `SdkConfigWire` and `PlacementWire`; `runCatching` inside `objectMap`; fixtures on both sides. Closes NSD-5, NSD-20. **S**
6. **Take the ABI decisions before anything consumes the published artifact.** `api(libs.compose.runtime)` or a third artifact; decide futures-vs-callbacks. These are free now and breaking later. Closes NSD-7, NSD-8. **M**
7. **Add a simulator test job for iOS.** `xcodebuild test -destination 'platform=iOS Simulator'`; the seams already exist (every dependency is an injected `@Sendable` closure). Closes NSD-12 and makes NSD-9/NSD-10 regression-testable. **M**
8. **Subscribe deep links from `onActivityStarted` too, and warn on the Compose disposal constraint pending a two-destination harness.** Closes NSD-14, NSD-15. **S** now, **M** for the harness.
9. **Regenerate `contract.md` §1.1 from `SHARING_PARAMS` and document the `/install` probe fragment.** Ideally dump the table from a test so it cannot drift again. Closes NSD-17, NSD-19. **S**
10. **Delete the stale `resetAnonymousId()` sentence and propagate the store's I/O failures.** A merchant wiring a GDPR flow off that boolean is being told the identity rotated when it did not. Closes NSD-18. **S**
11. **Fix the iOS install flow's two defects.** Re-check `!closed, webView != nil` after each await and stop the probe on `didDetectInstall`'s early returns; move the store rung above the `pair` guard. Closes NSD-9, NSD-10. **S**
12. **Decide the WebView data-store policy and wire it to consent.** Closes NSD-11. **M**
13. **Strengthen the ABI gate with a nullability/equality companion test, and correct the README's `@Target` sentence.** Closes NSD-13. **M**
14. **Sweep the low cluster** — default ports, deterministic truncation plus its two missing tests, iOS finiteness guard, bounded `IdentityMerge` sets, mirror manifest, duplicated dispatcher, XML comment, `TrackingConsent` doc. Closes NSD-21 through NSD-27. **M** in aggregate.

## Re-verification 2026-09-04

Against `dev` @ `5f7c52f33`. Every finding's path was re-read; no Gradle or `swift test` run was executed, so "zero test references" claims remain greps. The list above is left as the 2026-08-15 schedule; the corrected order is at the end of this section.

**The money-path premise was wrong at the time of writing.** NSD-2, NSD-3 and the verdict all rest on "`Interaction.arrival` carries no idempotency key, so a replay is double-counted attribution." It is not: `services/backend/src/api/schemas/interactionSchemas.ts` states in its first comment that arrival keys on the upstream `referralLinkId`, `ReferralService.registerReferral` returns `registered: false` on an existing edge, and `referral_links_merchant_referee_unique` enforces first-referrer-wins at the row level — all since `62eca646b` (2026-07-30), two weeks before the audit. A replayed backlog costs bandwidth, rate-limit budget and log noise, plus a flush that spins on every `track()` while the disk is full. That is a reliability defect and it still needs the S-sized fix (return the durability flag, retain accumulators, arm the backoff, port `checkpoint()` to iOS); it is not a payout defect. The two SDK comments that seeded the over-grade — `Interaction.kt` and `EventOutbox.swift`'s consent-withdrawal note — should be rewritten when NSD-2 lands. Consequently: **drop the "give `arrival` an idempotency key" half of action 2**; NSD-2 → Medium / P1-next, NSD-3 → Medium / P2, NSD-4 → Medium / P1-next for the log line (its impact is lost purchase claims, not duplicates, and iOS has the identical drop at `EventOutbox.swift` and mint-on-corrupt at `DeviceKey.swift`, which the finding listed as Android-only), NSD-5 → Medium / P2.

**NSD-6 is Low.** The saturation reproduces (`1e19` → `Long.MAX_VALUE`) but needs an integral price ≥ 2^63; realistic large prices take the exponent path and emit valid JSON, and the value feeds a local cache key. Two corrections to the body: the Kotlin golden tests it says do not exist do (`RewardRepositoryTest`, since `eaabcd837`), and Swift's own `description` diverges from `JSON.stringify` above 1e16, so the parity comment at `RewardRepository.kt` is wrong on both platforms, not one.

**Two findings have decayed since the audit without changing severity.** NSD-12: `scripts/run.sh:do_test` and `.github/workflows/apps.yaml` both compile the suites at the simulator triple and then run bare `swift test` on the host, where `#if canImport(UIKit)` is false; four suites were added behind that guard after the audit (`13179e037`, `3dd6844a9`) and none has ever executed. NSD-17: `contract.md` §1.1 was edited nine times after the audit and every phantom param (`attribution`, `native=1`, `preload=1`, `confirmed=1`, `r=`, `sdkv=`) survived every edit while correct rows were added beside them — hand-editing has been demonstrated not to work, so generate §1.1 from `SHARING_PARAMS`, special-casing `lng`, which i18next reads from the query string without passing through `table.ts`. Both stay **Medium**: they measure how the work is done, not what a user or an integrator can hit, and this report grades on reachable damage.

**Struck.** Two NSD-27 sub-items were wrong when written and are deleted: `@Throws(FrakError::class)` is on all four throwing entry points since `043da1c34`, an ancestor of the audited HEAD; and `Frak.shutdown` needs no `@JvmStatic` because `suspend fun` is not Java-callable regardless. NSD-24 → Informational: `JSONDecoder` on Swift-native Foundation rejects `1e999` with `dataCorrupted`; only the iOS 15–17 ObjC-backed path is unconfirmed. Add the fixture and close.

**Confirmed as written, with additions.** NSD-9's shape changed (`SharingSheetModel` was reworked four times; the probe now stops on detection but is still unbounded while the wallet is absent). NSD-19 widened: §2 was edited for `clip=host` and still omits the probe fragment. NSD-23 and NSD-25 have iOS twins the audit did not list (`EventQueue.swift` has no byte cap; `IdentityMerge.swift` has the same unbounded sets). NSD-26 was confirmed empirically — the staged mirror fails `swift package describe` — and two published tags carry it. NSD-27(a)'s two dispatchers have since diverged (`by lazy` vs eager).

**Doc drift.** All fourteen rows stand. `open.md` §0, the tracker added in `bf40b5bae` (2026-08-28), carries three rows that were already false at audit time. Both platforms are at `1.0.0-beta.2` with tags on `origin`; the plan docs still say `beta.1`.

**Corrected order.** (1) NSD-1a `setPackage` — still the best S-effort security fix in this report. (2) NSD-2 + NSD-3 as one reconcile-boolean change, NSD-4's log line. (3) NSD-7/8 ABI decisions, unchanged clock — they are free now and breaking the moment a merchant integrates. (4) NSD-12: run the UIKit suites on a simulator in CI, which is also what makes NSD-9/NSD-10 regression-testable. (5) NSD-14, NSD-5/20, NSD-18, NSD-9/10. (6) NSD-17: generate §1.1. (7) The low sweep plus the iOS twins of NSD-4/23/25. NSD-12 and NSD-17 sit lower here than the 2026-09-04 pass first placed them: neither ships a defect, so neither outranks a real one.

## Audit coverage

**Not examined.**
- **No native toolchain.** No JDK 17/`ANDROID_HOME`, no Xcode. `./gradlew check`, `apiCheck`, `swift build`, `swift test` and `swift format lint` were not run; every native claim is from reading the tree. I did not verify that the committed ABI dumps match current sources — only that they are internally consistent with the code I read.
- **Anything needing a device or emulator.** `AndroidKeystoreDeviceKeyStore` (no JVM provider), StrongBox availability and key-invalidation recovery, `SharingHostStyle.install`'s `DOCUMENT_START_SCRIPT` path, the `SharingHost` attach/detach/`ViewModelStore` lifecycle, real WebView/WKWebView interception under sub-frame and `window.open` conditions, warm-pool fragment activation timing, and R8's effect on the public surface. CI does not execute these either.
- **Process death mid-drain** beyond what `RECONCILE_EVERY` and the temp-file rename claim.
- **NSD-24 is unconfirmed by execution** — Foundation's `JSONDecoder` behaviour on an out-of-range literal needs a one-line test on a real toolchain before the finding is acted on.
- **Backend acceptance rules for `frak-install-v1`.** The blast radius of NSD-1a and of the accepted NSD-1b depends on how `/install` validates and whether it binds the proof to a channel; that surface belongs to the identity-proof scope and was not read here. The code path and payload are verified; the end impact is inferred. The residual risk recorded under NSD-1b is stated against the documented 30-day acceptance window, not against an executed redemption.
- **Privacy-manifest propagation into a real consumer app.** The `.copy` of `PrivacyInfo.xcprivacy` into a static SPM product is the exact configuration the known AppsFlyer failure was reported against; it lands on the merchant's upload as ITMS-91053 and nobody has verified it.
- **iOS 15/16 paths** (`SharingSheetChrome`, `SheetBackground`, `applyDetents`' stand-in) are unexercised anywhere.
- **Cross-scope side effects only partially covered.** The backend user API, the `/sharing` + `/install` standalone entrypoints, `wallet-shared`'s sharing refactor and merchant allowed-package-ids are treated here only where a native contract touches them (NSD-17, NSD-19). They belong to the other two scope reports.

**Adjudications made against the raw auditor findings.** Three were corrected before publishing. (1) The iOS `resetAnonymousId` read-back defect was reported as the unreadable-file path returning a false negative; reading `FileKeyValueStore.removeValue` shows that branch deletes the whole file and is sound — the real defect is the discarded `try?`/`write()` failure leaving the memo out of step with disk, so NSD-18 is restated on the correct mechanism. (2) The Android `Double.jsonNumber` finding was reported as a formatting divergence; it is that *and* a wrong value, since narrowing saturates — verified by reproducing the algorithm, which raised it to High. (3) Two `open.md` rows reported as open are closed in the tree (`FrakSdkVersion` KDoc, `shutdown`'s listener leak), and S11's "incidental" characterisation is wrong; all three are recorded as doc drift rather than findings. Separately, and *not* an adjudication: the split and downgrade of NSD-1 into NSD-1a/NSD-1b is an owner decision, recorded under [Owner decisions applied](#owner-decisions-applied-2026-08-15). The technical evidence in both arms — paths, quotes, payload and mechanism — is unchanged from the original finding.
