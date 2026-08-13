# Review — tracking/delivery, identity and time (both platforms)

Branch `review/alpha-fixes` (= `origin/fix/native-sdk-alpha-audit`) vs base `f1dc693`.
Commits in scope: `052e44c`, `96024ee`, `f6ff19a`, `d88272d`.
Verified by source read only (no JDK / Android SDK / Swift toolchain). Branch tree extracted to `/tmp/frak-fixes/br`; all `path:line` below are **as of `review/alpha-fixes`**, not the worktree checkout (the worktree sits at `71ee1e3`, base-side line numbers differ).

---

## Verdict

Mergeable for an alpha, with eyes open — nothing here is a blocker, but the commit message oversells the blast radius by roughly one platform. Three of the nine claims in my area are **Android-only while the message says "both platforms"**: `ServerClock` (§3.7), the queue byte cap + custom-data bounds (android-core F5), and `resetAnonymousId` awaiting its purge (android-core F11). `docs/plans/native-sdk/12-alpha-audit-response.md:51` is honest about the first of these; the commit message is not, and the other two are not disclosed anywhere. The two genuinely cross-platform fixes — `.rejected → continue` and drain-time `clientId` stamping — do land, on both platforms, with a test each that pins the property.

`ServerClock` is the highest-risk item and it is half-built: it adopts any `Date` header with no upper skew bound, is not persisted, and is not consulted before the first response — which is exactly when the 30-day install proof is minted. Its only test exercises the class in isolation; nothing pins that `HttpClient` feeds it or that `signProof` reads it, and a mis-wire degrades silently to the device clock by design (`AnonymousIdStore.kt:46` defaults it). The backend half (`f6ff19a`) widened the *past* window only — `MAX_FUTURE_SKEW_SECONDS = 60` is untouched, so the audit's literal headline ("a device 61 s **fast** fails every proof") is unaddressed server-side and entirely unaddressed on iOS.

Five of the nine claims ship with **no test at all** (byte cap, data bounds, 20-row checkpoint, drain coalescing, `resetAnonymousId` await, `merchantId` UUID, `claimArrival`). The 20-row checkpoint is a net performance regression against the audit's own F5.

---

## Fixes that land

| Finding | What was done | Proof |
|---|---|---|
| §3.2b / backend F8 / android-core F10 / ios-core F1 (queue half) | `.rejected` now `continue`s the drain on **both** platforms | `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt:271-276`; `sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift:308-320` |
| ↳ retry bound still holds | `recordRetry` still drops at `MAX_FAILURES = 3` and the failure is persisted through the `retried` map → `reconcile` | `EventOutbox.kt:173-186`, `:298`; `EventOutbox.swift:308-315` |
| ↳ tested | Both platforms pin "a poison row does not stall the row behind it", and both pin eventual drop after 3 passes | `EventOutboxTest.kt:203-213`, `:181-197`; `EventOutboxTests.swift:253-278`, `:236-252` |
| §3.2a / android-core F10 / ios-core F1 (stamping half) | `clientId == null` is stamped with the current id at drain; still-null → `.hold`, not a header-less POST | `EventOutbox.kt:240-253` + `EventQueue.kt:43-45`; `EventOutbox.swift:281-289` + `EventQueue.swift:103-107` |
| ↳ tested | "stamps a row captured before any id existed" and "holds … rather than posting it header-less", both platforms | `EventOutboxTest.kt:114-131`; `EventOutboxTests.swift:771-789` |
| android-core F9 (partial) | Android checkpoints the accumulator every 20 rows, bounding replay after a mid-drain kill | `EventOutbox.kt:213-221`, `:396` — the *claim* is accurate; see **N1** for the cost |
| android-core F5 (coalescing half) | Android collapses enqueue bursts into one drain via an `IDLE/DRAINING/DRAIN_AGAIN` `AtomicInteger`; I traced the interleavings and found no lost wakeup (the append completes under `queueMutex` before `scheduleFlush` reads the state, and the next `flush()` re-reads the file) | `EventOutbox.kt:104-136` |
| android-core F6 | Non-default process is detected and reported | `Frak.kt:206-221` |
| android-core F13 | `DeepLinkObserver` no longer writes an extra into the merchant's `Intent`; identity-keyed `WeakHashMap`, and only URLs carrying `fCtx`/`fmt` are consumed | `applink/DeepLinkObserver.kt:30-38`, `:53-60` |
| ios-core F11 | Inbound `fCtx` claimed once per process, both platforms, keyed on the raw context value | `DefaultFrakClient.swift:342-347` + `Identity/IdentityMerge.swift:48-51`; `DefaultFrakClient.kt:281-283` + `identity/IdentityMerge.kt:26-32` |
| merchantId UUID (partial) | Validated client-side on both platforms with a named cause | `config/MerchantQuery.kt:52-58`; `Config/MerchantQuery.swift:43-49` — but see **P8** |
| ios-core F3 (half) | `FrakStorage.directory()` memoised under an `NSLock` | `Core/FrakStorage.swift:8-17` |
| ios-core F5 (half) | `shutdown()` finishes the `configUpdates` continuations | `Config/ConfigStore.swift:106-112`, `DefaultFrakClient.swift:186` |
| android-core F4 (half) | The queue file path resolves lazily inside `ioDispatcher` | `tracking/EventQueue.kt:96-107`, `Frak.kt:96-100` |
| backend | `sharingTimestamp` documented and bounded as Unix seconds on all three surfaces | `interactionSchemas.ts:19-23`, `Interaction.kt:58-63`, `Interaction.swift:34` — but see **N7** |

---

## Fixes that DO NOT fully land

### P1. §3.7 / android-core F8 — `ServerClock` exists on Android only, and the server-side half fixes the wrong direction

- **Claimed in** `96024ee`: *"New `ServerClock` learns the backend's clock from the `Date` header and stamps proof timestamps with it, so a device whose clock is a minute out stops failing every signature it makes (android-core F8)."* — filed under a bare heading **"Identity and time:"**, with no platform qualifier, in a message whose delivery section is explicitly headed *"both platforms"*.
- **Reality**:
  - iOS still stamps every proof from the raw device clock: `sdk/ios/Sources/FrakSDK/Identity/AnonymousIdStore.swift:71` — `ts: Int64 = Int64(Date().timeIntervalSince1970)`. `rg ServerClock sdk/ios` → zero hits. There is no `Date`-header read anywhere in `sdk/ios/Sources/FrakSDK/Net/HTTPClient.swift`.
  - The response doc **does** disclose this (`docs/plans/native-sdk/12-alpha-audit-response.md:51`: *"iOS still stamps from the device clock — porting `ServerClock` … is the remaining half"*). The commit message does not. A reader of `git log` will believe §3.7 is closed.
  - The server-side half is asymmetric: `f6ff19a` widened `frak-merge-v1` from 2 → 10 minutes (`services/backend/src/domain/identity/services/IdentityProofService.ts:24`) but left `MAX_FUTURE_SKEW_SECONDS = 60` (`:34`) and the `ts > now + 60 → false` check (`:65`) untouched. The audit's headline case is a device running **fast**, which is bounded by that 60 s, not by the op window. So `f6ff19a` helps a slow clock and a queued retry; it does nothing for the case the finding is named after.
- **Residual severity**: high (iOS half untouched on the reward-bearing proof path; the backend half is marketed as *"helps every client"* in `12-…-response.md:51` when it helps only one direction of drift).
- **What to do**: port `ServerClock` to `HTTPClient` + `AnonymousIdStore` on iOS (mechanical, as the response says), and either raise `MAX_FUTURE_SKEW_SECONDS` in step or stop describing the window widening as a clock fix.

### P2. §3.7 — the Android `ServerClock` trusts an unbounded skew, forgets it at every launch, and is not consulted for the first proof

- **Claimed in** `96024ee`: *"stamps proof timestamps with it, so a device whose clock is a minute out stops failing every signature it makes."*
- **Reality** (`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/ServerClock.kt`):
  1. **No upper bound on the adopted offset.** `:26` rejects only `serverMillis < 1_735_689_600_000` (2025-01-01). A `Date: Fri, 01 Jan 2027 …` from a TLS-terminating corporate proxy, a stale CDN edge, or a merchant-configured `FrakEnvironment.Custom` origin (`core/FrakEnvironment.kt:33-65` accepts **any** `https://` host, and `http://` to any RFC-1918 address) is adopted verbatim at `:28-29` and skews every proof the device signs. The in-code comment at `:23-24` claims this *"guards a broken proxy"* — it guards only a proxy stuck before 2025. A `±` bound relative to the device clock, or an outlier/median-of-N rule, is the missing half.
  2. **Not persisted.** `offsetMillis` is a field on a per-`Frak.initialize` instance (`Frak.kt:90`). Every cold start relearns from zero.
  3. **The first proof of a launch can precede the first response.** `nowMillis()` falls back to `wallClock()` when nothing has answered. `DefaultFrakClient.kt:150-158` does fire an eager `resolveConfig()` at init, so in practice a `Date` usually lands within a second — but there is no gate: `openFrakApp()` (`DefaultFrakClient.kt:327`) and `installPageUrl()` (`:363`) mint an **install** proof at a user gesture, and that proof is a 30-day credential minted once. Launch offline (or with the resolve still in flight), tap install, and you burn a 30-day proof stamped from the drifted clock — permanently invalid even after the clock is corrected.
  4. **No monotonic anchor.** `nowMillis() = System.currentTimeMillis() + offset` (`:22`). If NTP corrects the device *after* an offset was learned, the correction is double-applied until the next response overwrites the offset.
  5. **The wiring is untested and fails open.** `AnonymousIdStore.kt:46` defaults `serverClock = ServerClock()`, and `DefaultFrakClient.kt:63` does the same — a construction site that forgets to pass the shared instance silently reverts to the device clock with no diagnostic. `ServerClockTest.kt` (41 lines) exercises the class alone; nothing asserts that `HttpClient.perform` calls `observe` (`net/HttpClient.kt:183`), that `signProof` reads it, or that `Frak.initialize` shares one instance.
- **Residual severity**: high (unbounded skew adoption is a new failure mode; the install-proof cold-start gap is the one that costs a merchant real attribution).
- **What to do**: bound the adopted offset (reject > ~24 h, or require two agreeing observations); persist it next to the identity store; add a `hasObserved` flag and either defer the install proof or log loudly when one is minted without a server clock; anchor on `SystemClock.elapsedRealtime()` at observation time; add one integration test that stubs a `Date` header and asserts the resulting proof `ts`.

### P3. android-core F5 — the byte cap and the custom-data bounds are Android-only, under a "both platforms" heading

- **Claimed in** `96024ee`, under **"Delivery, both platforms:"** — *"The queue gains a byte cap alongside the row cap, and a custom interaction's data map is bounded at 32 entries / 512 chars per field."*
- **Reality**: Android only.
  - Byte cap: `sdk/android/.../tracking/EventQueue.kt:199`, `:228-243`, `:379` (`MAX_BYTES = 2 MiB`), append-side stat at `:277`. iOS: `sdk/ios/Sources/FrakSDK/Tracking/EventQueue.swift:246` is still `events.count > Self.maxEvents ? …` and `rg -i "maxbytes|bytebudget" sdk/ios` returns nothing.
  - Data bounds: `sdk/android/.../tracking/EventOutbox.kt:369-388`. iOS: `sdk/ios/.../Tracking/EventOutbox.swift:390-396` writes `"data": data` verbatim with no cap on entries, key length, value length or `customType`.
- **Residual severity**: medium. The same merchant code now produces different rows on the two platforms (see P4), and iOS keeps the unbounded-disk-growth half of F5 that the fix was for.
- **What to do**: port both caps to iOS, or state in the commit message and `12-…-response.md` that this is Android-only.

### P4. android-core F5 — the data bound truncates the merchant's data silently, with the wrong ceiling, and the KDoc still promises "verbatim"

- **Claimed in** `96024ee`: *"a custom interaction's data map is bounded at 32 entries / 512 chars per field."*
- **Reality** (`sdk/android/.../tracking/EventOutbox.kt:369-388`):
  - Per-field truncation (`key.take(512)`, `value.take(512)`, `customType.take(512)`) emits **no diagnostic at all**. Only the >32-entries case warns (`:377-382`).
  - The one warning that does exist goes to `logger.warn`, and `FrakLogLevel` defaults to `NONE` (`core/FrakConfig.kt:139`). Default-configured merchants are told nothing about either truncation.
  - **Key truncation can collide**: two keys differing only after char 512 both `data.put(...)` the same truncated key — the second silently overwrites the first, so the row loses a field beyond the truncation itself.
  - `kind.data.entries.take(32)` on a `Map` handed in by the merchant and copied with `data.toMap()` (`Interaction.kt:95`) preserves the source's iteration order — for a `HashMap` that is an **arbitrary** 32 of N, not "the first 32" as the warning text at `:379-381` claims.
  - `customType` is capped at **512** but the backend's schema caps it at **100** (`services/backend/src/api/schemas/interactionSchemas.ts:31`, `maxLength: 100`). A 300-char `customType` still passes the client bound and still 422s — and with the new `continue`, it now burns three requests before being dropped instead of one.
  - The backend places **no** limit on `data` (`interactionSchemas.ts:32`, `t.Record(t.String(), t.Unknown())`). So this is purely client-side loss of data the server would have accepted.
  - The public contract was not updated: `sdk/android/.../tracking/Interaction.kt:78` still reads *"`[data]` is sent verbatim as the event's `data` object"*. It is no longer verbatim. No mention in `sdk/android/README.md` either (`rg '512|32 entries|truncat' sdk/android/README.md` → nothing).
- **Residual severity**: medium (silent, undocumented, cross-platform-divergent mutation of merchant analytics data).
- **What to do**: align `customType` with the server's 100; reject-and-report (a `FrakResult.Failure` or at minimum a `logger.error`) rather than truncate; document the caps in the KDoc/Swift doc and both READMEs; use a `LinkedHashMap`/sorted-key order so the retained subset is deterministic; detect key collisions.

### P5. android-core F11 — `resetAnonymousId` awaits its purge on Android only, and the audit's second half was not done

- **Claimed in** `96024ee`: *"`resetAnonymousId` awaits its purge instead of detaching it, which could erase an event tracked under the new id."*
- **Reality**:
  - Android: fixed — `core/DefaultFrakClient.kt:119-124`, `if (erased) tracker.purge()`. No main-thread I/O: `purge()` → `queue.clear()` → `withContext(ioDispatcher)` (`tracking/EventQueue.kt:366-368`), so the caller only suspends. ✅
  - **iOS is unchanged**: `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:156-157` is still `let tracker = self.tracker; Task { await tracker.purge() }`. The exact defect described is still live on iOS. Not disclosed in the commit message or in `12-…-response.md`.
  - The audit's fix sketch had two halves (`audit-2026-08-13/android-core.md` F11): *"`tracker.purge()` inside the suspend body **and purge by `clientId` rather than truncating the file**"*. Only the first landed. `queue.clear()` still deletes the whole file.
  - Residual on both platforms: awaiting the purge does not stop an **in-flight** drain. `flush()` snapshots `currentClientId` once at `EventOutbox.kt:206` (iOS: `EventOutbox.swift:249`), so a drain that started before the reset keeps that snapshot and keeps POSTing rows captured under the id the user just asked to have erased — the `clientId != currentClientId` guard at `:229` / `:273` cannot fire, because it compares against the stale snapshot. `purge()` takes `queueMutex` but not `flushMutex`, so it cannot serialise against the drain.
- **Residual severity**: medium (iOS half untouched; the in-flight-drain residual is privacy-relevant).
- **What to do**: `await tracker.purge()` on iOS; add a reset generation counter the drain re-reads per row (the outbox already re-reads `trackingAllowed()` per row, `EventOutbox.kt:224`), so a mid-drain reset stops the pass.

### P6. android-core F9 — the checkpoint fix is Android-only and iOS still reconciles once per pass

- **Claimed in** `96024ee`: *"Android reconciles the queue every 20 rows instead of once per pass, bounding what a mid-drain process kill replays."* (accurate as scoped)
- **Reality**: iOS `drain()` still accumulates for the whole pass and reconciles once (`sdk/ios/.../Tracking/EventOutbox.swift:250-252` accumulators (`EventOutbox.swift:249` snapshot), single `queue.reconcile` after the loop). The audit only filed F9 against Android, but the defect is identical on iOS — the platform is *more* likely to suspend a background drain, not less. Cost of the Android fix: see **N1**.
- **Residual severity**: low-medium (backend is idempotent for all three row shapes; the cost is redundant traffic plus a merge row burning its failure cap on an already-consumed token).
- **What to do**: either port the checkpoint to iOS, or record that iOS accepts the whole-pass replay window.

### P7. Five of the nine claims ship with no regression test

- **Claimed in** `docs/plans/native-sdk/12-alpha-audit-response.md:67-70`: *"Every one of them is green under the repo's own gates … (536 tests) … (495 tests)."* Green is not the same as covered.
- **Reality** — `git diff --stat f1dc693 review/alpha-fixes -- '*Test*' '*Tests*'` touches 11 files; nothing tests:
  - the byte cap or `withinByteBudget` (`EventQueueTest.kt` / `EventQueueTests.swift` untouched);
  - the 32/512 data bounds;
  - `RECONCILE_EVERY` / mid-drain checkpointing;
  - `scheduleFlush` coalescing (the state machine at `EventOutbox.kt:104-136` — the one piece of new lock-free concurrency in the branch);
  - `resetAnonymousId` awaiting the purge;
  - `MerchantQuery` UUID rejection (`MerchantQueryTest.kt` / `MerchantQueryTests.swift` untouched on both platforms);
  - `claimArrival` dedup on either platform;
  - `HttpClient` actually feeding `ServerClock` from a `Date` header (see P2.5).
- **Residual severity**: medium. Every one of these is a property that a later refactor can silently undo.
- **What to do**: at minimum a wiring test for `Date → ServerClock → signProof.ts`, a `scheduleFlush` burst test, and a byte-cap test.

### P8. `merchantId` UUID validation only guards the config-resolve path

- **Claimed in** `96024ee`: *"`merchantId` is validated as a UUID client-side; the backend's bare 422 named no cause."*
- **Reality**: the check lives in `MerchantQuery.from` (`config/MerchantQuery.kt:52-58`, `Config/MerchantQuery.swift:43-49`), which is only on the `/user/merchant/resolve` path. `MerchantIdentity.merchant()` returns `settings.merchantId` unvalidated when nothing is cached (`identity/MerchantIdentity.kt:40-46`, via `preferBackend` at `:72-75`), so an invalid id still reaches `signProof(op, merchantId)` and the interaction body — where the backend's `merchantId: t.String({format:"uuid"})` (`interactionSchemas.ts:8/17/30`) 422s it with, again, no named cause. And the eager init resolve swallows the new error at `debug` level (`core/DefaultFrakClient.kt:154-158`), which is below the `NONE` default.
- **Residual severity**: low.
- **What to do**: validate in `FrakConfig.Builder.merchantId(...)` / `FrakConfig.init`, where the merchant is looking.

---

## NEW defects introduced by this branch

### N1. The 20-row checkpoint is a full file read + rewrite, so a long drain now does ~50 of them

- **Severity**: medium
- **Axis**: performance / battery — on the purchase path
- **Complexity**: small
- **Introduced by**: `96024ee`
- **Evidence**: `sdk/android/.../tracking/EventOutbox.kt:213-221` — `checkpoint()` calls `queue.reconcile(...)`, and `EventQueue.reconcile` (`:351-364`) is `readLocked` (`file.readLines()` + `QueuedRow.fromJson` on every line, `:161-175`) followed by `replaceLocked` (temp file + rename). `RECONCILE_EVERY = 20` (`EventOutbox.kt:396`).
- **What actually happens**: a full 1000-row / 2 MiB backlog drain now performs **~50 whole-file reads and 50 whole-file rewrites** instead of 1, i.e. ~100 MiB of I/O and 50 000 JSON row parses, on the 2-thread IO dispatcher — this is precisely the cost android-core **F5** was filed about (*"50 sequential full reads + JSON parses of a file that can be tens of MB … visible jank and a plausible OOM"*). The fix for F9 made F5 measurably worse on the same file. Each checkpoint also takes `queueMutex`, which `track()` needs to append — so a merchant's `trackPurchase` call can now block behind a 2 MiB rewrite, 50 times per drain.
- **Fix sketch**: checkpoint by appending tombstones/`delivered` row-ids to a small sidecar the next `read` applies, or make the checkpoint O(delta) rather than O(file); failing that, raise `RECONCILE_EVERY` well above 20 and only checkpoint when `delivered.size` crosses a threshold (the accumulator is already cheap to inspect at `:214`).

### N2. `.rejected → continue` has no per-pass budget and does not feed the backoff, so a mass rejection becomes a request storm

- **Severity**: medium
- **Axis**: correctness / cost
- **Complexity**: trivial
- **Introduced by**: `96024ee`
- **Evidence**: `EventOutbox.kt:266-276` — `Retryable` calls `backoff.recordFailure` and `break`s; `Rejected` calls neither and `continue`s. Same on iOS: `EventOutbox.swift:305-320`.
- **What actually happens**: before the change, one poison row cost one request per drain. Now, an event class that rejects wholesale — a backend schema tightening (see **N7**), a wrong `merchantId` (see **P8**), a 401 after a keystore rotation — produces **one HTTP request per queued row per drain**, up to `MAX_EVENTS = 1000`, for three drains (`MAX_FAILURES = 3`) before the queue clears. That is up to 3000 sequential POSTs where there used to be 3, with no backoff engaged, and drains are enqueue-triggered so a busy app re-drives it. The audit asked for `continue` and was right to; it did not ask for it unbounded.
- **Fix sketch**: cap rejections per pass (e.g. `break` after 10 consecutive `Rejected`), and/or feed a `Rejected` streak into `backoff` so a wholesale rejection throttles like an outage does.

### N3. A `.hold` on a null `clientId` serialises the hold timeouts: N such rows take N × 24 h to clear

- **Severity**: medium
- **Axis**: correctness
- **Complexity**: small
- **Introduced by**: `96024ee` (the `.hold` half of §3.2a)
- **Evidence**: `EventOutbox.kt:252-253` (`row.clientId == null → DeliveryOutcome.Hold`) and `:278-282` — a row with `heldSince == null` is stamped and the drain **`break`s**. `DEFAULT_HOLD_TIMEOUT_MILLIS = 24 h` (`tracking/RowSender.kt:48`). iOS is structurally identical (`EventOutbox.swift:321-336`, `RowSender.swift:13`).
- **What actually happens**: the *second* null-id row's 24-hour clock does not start until the *first* one has expired and been dropped, because the drain breaks at the head of the queue. Ten such rows take ten days to clear. The audit (§3.2 fix) asserted *"`.hold` is strictly better"* than `.dropped`; it is not — `.dropped` (the `MergeSender.kt:26-28` precedent the audit itself cited) clears the queue in one pass. Mitigations: on iOS `drain()` refuses to start at all when the identity store is unreadable (`EventOutbox.swift:237` `guard await identityReadable()`), which keeps most of this unreachable there; **Android has no such guard** (`rg identityReadable sdk/android` → nothing), so Android is the exposed platform. In the common case the rows are unsendable anyway, so no attribution is lost — but a row carrying an explicit non-null `clientId` (e.g. a queued merge, `EventOutbox.kt:156`) queued behind a null row *is* sendable and is now blocked for a day.
- **Fix sketch**: on a null-`clientId` hold, `continue` rather than `break` (the row is not "waiting for the network", it is waiting for a device state that is identical for every row behind it); or mirror iOS's `identityReadable` guard on Android; or start `heldSince` at capture time rather than at first hold.

### N4. Drain-time stamping can mis-attribute a pre-reset row when `purge()`'s file delete fails

- **Severity**: low
- **Axis**: correctness / privacy
- **Complexity**: trivial
- **Introduced by**: `96024ee`
- **Evidence**: the stale-id guard at `EventOutbox.kt:229` (`event.clientId != null && … != currentClientId → drop`) is skipped for `clientId == null` rows, which then take the stamping branch at `:243-250`. `EventQueue.deleteFile()` swallows its failure and returns `false` (`EventQueue.kt:371-372`); `purge()` ignores the result (`EventOutbox.kt:139-141`).
- **What actually happens**: a row captured while the identity store was unreadable, surviving a `resetAnonymousId()` whose file delete failed, is stamped with the **new** anonymous id at the next drain and posted — attributing pre-reset behaviour to the post-reset identity. That is exactly what `:229` exists to prevent, and the new branch routes around it. Narrow (requires a failed `File.delete`), but it is a privacy-direction regression, not just data noise.
- **Fix sketch**: record a reset epoch (millis) alongside the identity and refuse to stamp a row whose `capturedAtMillis` predates it; or drop rather than stamp a null-id row older than the last reset.

### N5. The merge proof window was widened 5× on a rationale the code contradicts

- **Severity**: low-medium
- **Axis**: security
- **Complexity**: trivial (revert the comment, or the change)
- **Introduced by**: `f6ff19a`
- **Evidence**: `services/backend/src/domain/identity/services/IdentityProofService.ts:18-21` — *"the token it is bound to is **single-use** and short-lived, so replay is bounded by the token, not by this"*. `AnonymousMergeService.generateToken` (`:36-43`) mints a **plain JWT with a 60-minute lifetime**; `validateToken` (`:56-90`) verifies the signature, the merchant match and the source group's existence — there is no burn, no nonce store, no `usedAt` column. `MergeSender.kt:50` carries the same false belief (*"A merge token is single-use"*).
- **What actually happens**: the `frak-merge-v1` proof-replay window went 2 min → 10 min (`:24`) while §2.2 (auto-executed `?fmt=` with no origin check) is still open, justified by a single-use property the token does not have. The blast radius is small — replaying a captured (token, proof) pair re-merges the same source into the same target — but the justification is not load-bearing and should not be left in the tree as if it were.
- **Fix sketch**: either burn the merge token server-side (an `anonymous_merge_tokens.used_at` latch) and keep 10 min, or keep 2 min and fix the comments on both surfaces.

### N6. A regression assertion was deleted under a commit message that says only "chore: fix ios sdk test"

- **Severity**: low
- **Axis**: tests
- **Complexity**: trivial
- **Introduced by**: `052e44c`
- **Evidence**: `sdk/ios/Tests/FrakSDKTests/Net/HTTPClientTests.swift` — the test was renamed from *"the overall deadline bounds a retried request rather than doubling the per-attempt wait"* to *"the overall deadline spans the retry backoff…"*, `overallDeadlineSeconds` dropped from `0.5` to `0.05`, `#expect(attempts.value == 2)` became `== 1`, and `#expect(elapsed < 1)` was deleted outright.
- **What actually happens**: the surviving test proves the deadline fires *during* the backoff sleep. Nobody now tests that a request which **does** retry is bounded by the overall deadline rather than by 2 × the per-attempt timeout — the property the deleted assertion existed for. The commit body is one repeated line and gives no reason (presumed flake).
- **Fix sketch**: keep the new test and re-add a deterministic variant of the old one (inject the jitter source rather than racing it).

### N7. `sharingTimestamp` tightening turns a silently-wrong value into a hard 422 for existing clients

- **Severity**: low
- **Axis**: contract / compat
- **Complexity**: n/a (decision)
- **Introduced by**: `f6ff19a`
- **Evidence**: `services/backend/src/api/schemas/interactionSchemas.ts:21-23` — `t.Optional(t.Number())` → `t.Optional(t.Integer({ minimum: 0, maximum: 2_147_483_647 }))`. The native docs were corrected to say SECONDS (`Interaction.kt:58-63`, `Interaction.swift:34`), but `sdk/core/src/types/rpc/interaction.ts:24` is still an undocumented `sharingTimestamp?: number` and no in-repo producer sets it.
- **What actually happens**: any already-shipped client passing milliseconds (a plausible reading of the pre-fix docs, and a frozen native binary cannot be corrected) moves from "accepted, then the `(payload->>'sharingTimestamp')::int` cast overflows" to a 422. Combined with **N2**, that row is now retried three times before being dropped. The change is right in direction; it is a wire-contract break that no changelog records.
- **Fix sketch**: coerce `> 2^31` down by 1000 server-side for one release with a metric, or state the break explicitly; document the unit on `sdk/core/src/types/rpc/interaction.ts:24`.

### N8. Nits in the new drain state machine

- **Severity**: nit
- **Introduced by**: `96024ee`
- **Evidence**: `EventOutbox.kt:100-102` — *"A cancellation leaves this at `DRAINING`"* — but the `catch (failure: Throwable)` at `:117` catches `CancellationException` too and resets to `IDLE` before rethrowing. The doc describes code that is not there. Separately, `DefaultFrakClient.kt:167` and `:173` still call `tracker.flush()` **directly**, bypassing the coalescer entirely — correct (they serialise on `flushMutex`) but it means the config-updates collector can queue an uncoalesced flush behind every config revalidation, which is half of what the coalescing was for. iOS routes its `flush()` through `scheduleDrain()` (`EventOutbox.swift:159-160`), so the platforms still differ on the exact axis `96024ee` claims to have aligned.

---

## Audit claims this branch proves wrong

- **`checkDexSizeBudget` never existed — the audit was wrong, and the branch is right.** Re-checked with full history: `32836c217` *"build(sdk/android): drop the dex size budget"*, 2026-08-07, removes it with a measured rationale in the message. The audit's `git log -S` ran in an 11-commit shallow clone. `docs/plans/native-sdk/12-alpha-audit-response.md:15-19` states this correctly. Outside my area, but it is the one the task asked me to confirm, and it confirms.
- **§3.2's *"`.hold` is strictly better"* is wrong.** Implementing it exposed the serialised-hold-timeout behaviour in **N3**: `.dropped` clears a null-id backlog in one pass; `.hold` takes `N × holdTimeout`. The audit's own cited precedent (`MergeSender`'s drop) was the better advice.
- **android-core F8's *"the SDK never reads a server clock"* is confirmed, and was not a history artefact.** `git log -S getHeaderFieldDate --all` and `git log -S serverClock --all` both return only `96024ee` across all 6117 commits — no prior implementation was removed. The finding is genuinely NEW.
- **android-core F9's note that the backend comment about `isDuplicate` is false is confirmed** — the branch agreed and rewrote it (`services/backend/src/api/user/track/interaction.ts:58-64`), and `InteractionSender.kt:31` / `classifyStatus` still read only the status code.
- **Not adjudicable here**: `12-…-response.md:36` claims `bun run --cwd sdk/android lint` is green with the unused `StateFlow` import present, i.e. that ktlint 1.8.0 as configured does not flag unused imports. `sdk/android/.editorconfig` disables no such rule, so the audit's inference was reasonable; without a JDK I cannot settle it, and it is outside my area. It is worth 20 minutes to someone with a toolchain, because four documents depend on the answer.

---

## Verified-OK

- `.rejected → continue` does **not** create an infinite loop or a hot spin on either platform: `recordRetry` increments `failures` and drops at `MAX_FAILURES = 3` (`EventOutbox.kt:173-186`, `EventOutbox.swift:308-315`), and the incremented row is persisted through the `retried` map into `reconcile` (`EventQueue.kt:358`) — a permanently-rejected row is gone after three passes. The unbounded-request-count concern is **N2**, not a loop.
- `withClientId` preserves `failures`, `heldSince`, `rowId`, `capturedAtMillis` and `idempotencyKey` on both platforms (`EventQueue.kt:43-45`; `EventQueue.swift:103-107`), so a stamped row that then rejects carries its stamp into the retry.
- `resetAnonymousId` does **not** block a caller on disk I/O: `queue.clear()` hops to `ioDispatcher` (`EventQueue.kt:366-368`), so the merchant's coroutine suspends but no thread blocks. No lock-order inversion either (`flush` takes `flushMutex → queueMutex`; `purge` takes `queueMutex` only).
- The Android drain coalescer's CAS interleavings check out — I walked the `IDLE → DRAINING → DRAIN_AGAIN` transitions including the `set(DRAINING)`-clobbers-`DRAIN_AGAIN` window at `EventOutbox.kt:112`; the enqueue's `queue.append` completes before its `scheduleFlush()`, and the following `flush()` re-reads the file, so no event is stranded.
- `claimArrival` is correctly reachable on both platforms (only after `context != nil`, so the raw value is always present) and correctly guarded (`mutex.withLock` on Android, actor isolation on iOS). Note the sets grow unbounded per process on both (`IdentityMerge.kt:17`, `IdentityMerge.swift:13`) — bounded in practice, nit only.
- `ServerClock.observe` is thread-safe as written (`@Volatile` offset, `AtomicBoolean` warn latch) and self-heals on the next response; the concerns in **P2** are policy, not data races.
- `getHeaderFieldDate` is only fed from the single backend `HttpClient` (`rg 'HttpClient\(' sdk/android/frak-sdk/src/main` → `DefaultFrakClient.kt:65` and the class itself), so no CDN/wallet origin can set the clock today.
- `warnIfNotMainProcess` (`Frak.kt:206-221`) correctly guards on API 28 and reports rather than blocking, matching android-core F6's minimum ask.
- The byte-cap trim keeps the newest rows (`EventQueue.kt:229-236`), consistent with the existing `takeLast(MAX_EVENTS)` row-cap direction — so it does not *newly* prefer analytics over purchases, but it does extend the untiered eviction the audit's §5 reliability-tiering item warns about to a second axis.

