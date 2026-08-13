# Android core (`sdk/android/frak-sdk`) — alpha audit

Worktree: `/home/dev/wallet-audit` @ `c0a0cec`. Read-only; nothing compiled or executed (no JDK/SDK here). Every claim below is from reading source.

## Summary

The core module is unusually well-built for a first alpha: the identity wire format matches `sdk/core/src/identity/canonical.ts` byte-for-byte, the durable queue's reconcile/rowId/hold machinery is genuinely careful, the HTTP client is bounded on all three axes (connect/read/deadline + a 1 MiB streamed body cap), and the frozen ABI surface is defensible. The register (`06-open-findings.md`) is mostly accurate on this area; I found one row (9.2) whose *severity* is overstated, and several real problems nobody has filed.

The single worst thing is **F1: `DeepLinkHandling.Automatic` — the default — cannot see a warm-start deep link**, because `DeepLinkObserver` reads `activity.intent` and nothing tells merchants they must call `setIntent()` in `onNewIntent()`. The SDK's own KDoc asserts the opposite, and the project's own harness (`example/native-android`, `singleTask`) gets it wrong, which is exactly why the "inbound deep links have run nowhere" gap in AGENTS.md has not caught it. Second worst is **F2: nothing ever re-drives the outbox** — no timer, no foreground hook (iOS has one), no connectivity callback — so an event that fails once while offline sits on disk until the merchant tracks something else or the process restarts. Both are alpha-relevant for My Moulinex specifically: a referral arrival is a warm-start deep link, and a purchase is often tracked right as the user backgrounds the app.

Nothing here is a security hole. Two ship-blockers-if-true are cheap to check locally (F3 unused import → ktlint, F4 StrictMode).

## Findings

### F1. `DeepLinkHandling.Automatic` misses every warm-start referral link unless the merchant calls `setIntent()`

- **Severity**: blocker
- **Axis**: correctness / merchant-setup
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/DeepLinkObserver.kt:23-29` — `private fun consume(activity: Activity) { val intent = activity.intent ?: return; if (intent.getBooleanExtra(HANDLED_EXTRA, false)) return; val url = intent.data?.toString() ?: return … }`
  - `.../DeepLinkObserver.kt:8-11` claims the opposite: *"a `singleTask` activity delivers a warm-start intent via `onNewIntent`/`onResume`, never `onCreate`."* The framework hands the new `Intent` to `onNewIntent(intent)`; it does **not** update `Activity.getIntent()`. `activity.intent` therefore still returns the *launch* intent, already stamped `HANDLED_EXTRA=true` at line 27 on the cold start.
  - `example/native-android/app/src/main/kotlin/id/frak/example/android/MainActivity.kt:237-240` — the project's own harness, on a `singleTask` activity (`app/src/main/AndroidManifest.xml`, `launchMode="singleTask"`), overrides `onNewIntent` and never calls `setIntent(intent)`; its comment at :242 says *"Automatic mode already dispatched `handleReferral`"*, which is false for this path.
  - `sdk/android/README.md` — no occurrence of `onNewIntent`/`setIntent` anywhere (grepped); `DeepLinkHandling.Automatic` is the builder default (`core/FrakConfig.kt:135`).
- **What actually happens**: user has the merchant app in the background, taps a Frak share link, the app is brought forward via `onNewIntent`. The SDK observes `onActivityResumed`, reads the stale launch intent, sees `HANDLED_EXTRA`, returns. No `arrival` is tracked and no `fmt` merge is queued — silently, with no log. Every referral that lands on an already-running app is lost. On a cold start it works, which is exactly what a manual test would try first.
- **Fix sketch**: make the SDK not depend on merchant discipline — register `Activity.addOnNewIntentListener` (androidx `OnNewIntentProvider`, available on any `ComponentActivity`) in `onActivityCreated`, falling back to the current intent read; and document `setIntent(intent)` prominently for non-androidx hosts. Also fix the harness so the gap is visible.
- **Register status**: NEW (D2b/T3 note that inbound deep links have never run anywhere, but the defect itself is unfiled)

### F2. Nothing re-drives the event outbox: a single transient failure strands events until the next `track()` or process start

- **Severity**: high
- **Axis**: correctness / parity
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - Only three flush drivers exist: `tracking/EventOutbox.kt:69`, `:86`, `:111` (`scope.launch { flush() }` after each enqueue), `core/DefaultFrakClient.kt:163` (once, in `init`), and `core/DefaultFrakClient.kt:169` (`configStore.updates.filterNotNull().collect { tracker.flush() }`). Grep for `flush()` across `frak-sdk/src/main` + `frak-sdk-ui/src/main` returns nothing else.
  - `tracking/EventOutbox.kt:151` — `if (backoff.isBackingOff(BACKOFF_KEY)) return` — and `:196-199` `is DeliveryOutcome.Retryable -> { backoff.recordFailure(...); break }`. Nothing schedules a wake-up when the window expires.
  - iOS does have one: `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:123-132` — `for await _ in NotificationCenter.default.notifications(named: UIApplication.willEnterForegroundNotification) { await tracker.flush() }`.
  - `config/ConfigStore.kt:242` `FRESH_TTL_MILLIS = 5min` means the `updates` flow only re-emits after a network fetch actually publishes, so it is not a reliable substitute.
- **What actually happens**: user completes a purchase in a tunnel. `trackPurchase` enqueues, the flush fails (`FrakError.Network` → `Retryable`), backoff arms. Connectivity returns; nothing happens. The app is not killed (Android keeps processes alive for hours/days), the merchant tracks nothing else, so the purchase — the revenue-bearing event — sits in `frak-events.jsonl` until the process dies and restarts, or up to `MAX_AGE_MILLIS` = 14 days and then is dropped.
- **Fix sketch**: mirror iOS — register a `ProcessLifecycleOwner`/`ActivityLifecycleCallbacks` foreground hook that calls `tracker.flush()`, and/or schedule a `delay(backoff.remainingMillis)` retry coroutine on the SDK scope after a `Retryable`.
- **Register status**: NEW (9.7 mentions iOS's `foregroundTask` in passing; nobody filed the Android absence)

### F3. Unused `StateFlow` import in `DefaultFrakClient.kt` — `ktlintCheck` (and therefore CI `check`) should be red

- **Severity**: high
- **Axis**: build-release
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `core/DefaultFrakClient.kt:39` `import kotlinx.coroutines.flow.StateFlow`. `grep -n "StateFlow" core/DefaultFrakClient.kt` returns only that line — the symbol appears nowhere in the body or in KDoc. ktlint's `standard:no-unused-imports` is on by default and nothing disables it (`sdk/android/.editorconfig` sets only indent/line-length/trailing-comma/`ktlint_function_naming_ignore_when_annotated_with`); ktlint is applied to every subproject at `sdk/android/build.gradle.kts:30-36`.
- **What actually happens**: `bun run --cwd sdk/android lint` and the CI `check` step fail on a clean tree, or — if they currently pass — the lint gate is not actually running over `frak-sdk/src/main`, which is worse. I could not execute ktlint here, so treat this as "verify in 30 seconds locally"; either answer is a finding.
- **Fix sketch**: delete line 39; if the gate is green with it present, find out why ktlint is not seeing this source set.
- **Register status**: NEW

### F4. `Frak.initialize` does main-thread disk I/O, contradicting its own contract — StrictMode `penaltyDeath` kills the merchant app

- **Severity**: medium
- **Axis**: correctness / docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `Frak.kt:49` — *"Non-blocking, does no I/O, never throws."*
  - `Frak.kt:91` — `file = File(context.noBackupFilesDir, EVENT_QUEUE_FILE_NAME)`. `Context.getNoBackupFilesDir()` is `ensurePrivateDirExists(new File(getDataDir(), "no_backup"))` in `ContextImpl` — it `stat`s and `mkdir`s on the calling thread.
  - `README.md:151` and the sample at `:83` tell merchants to call `initialize` from `onCreate` (main thread). Everything else in the constructor is correctly lazy (`config/KeyValueStore.kt:27-29` `by lazy`).
- **What actually happens**: any merchant app with `StrictMode.ThreadPolicy.detectDiskWrites().penaltyDeath()` in its debug build (a common house style in large apps, and My Moulinex is a large app) crashes on launch, attributed to Frak. Everyone else eats one filesystem round trip on the critical launch path.
- **Fix sketch**: pass a `() -> File` provider into `EventQueue` and resolve `noBackupFilesDir` on `ioDispatcher` at first use, or make the whole `EventQueue.file` a `by lazy`. Then the KDoc is true.
- **Register status**: NEW

### F5. Queue is capped by row count only; every `track()` re-reads and re-parses the entire file

- **Severity**: medium
- **Axis**: performance
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - `tracking/EventQueue.kt:336` `MAX_EVENTS: Int = 1000` and `:335` a 14-day age cap — no byte cap anywhere.
  - `tracking/EventOutbox.kt:298-305` — `Interaction.custom`'s `data: Map<String,String>` is written verbatim into the row payload; nothing bounds key/value length or map size (`tracking/Interaction.kt:80-99` also does not).
  - `tracking/EventQueue.kt:147` `file.readLines()` loads the whole file, `:160` `present.mapNotNull(QueuedRow::fromJson)` JSON-parses every line — and `flush()` calls `queue.read` (`EventOutbox.kt:153`) plus `queue.reconcile` (`:225`), and `trackMerge` adds a third full read via `isQueued` (`:119-121`).
  - Compounded by register 9.4 (confirmed): `EventOutbox.kt:69,86,111` launch one flush per enqueue, and `flushMutex` serialises rather than coalescing them.
- **What actually happens**: a merchant that attaches a modest cart JSON to `Interaction.custom` and tracks 50 events in a burst while offline pays 50 sequential full reads + JSON parses of a file that can be tens of MB, on a 2-thread dispatcher. Visible jank and a plausible OOM on a low-end device; the "durable queue" also grows without any byte bound.
- **Fix sketch**: add a byte cap alongside `MAX_EVENTS` (trim on append), reject/truncate oversized custom payloads at `Interaction.custom`, and implement iOS's `drainTask`/`drainAgain` coalescing.
- **Register status**: confirms 9.4 (coalescing); the missing byte cap and the unbounded custom payload are NEW

### F6. Multi-process merchant apps get two anonymous ids and an unsynchronised queue file

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: small (<1d) for a guard; structural for real support
- **Evidence**:
  - `tracking/EventQueue.kt:88-89` — *"Single writer, nothing synchronised: every entry point is reached from `EventOutbox` under its `queueMutex`"* — a `kotlinx` `Mutex` is process-local; so is `Frak.session` (`Frak.kt:46-47`).
  - `identity/AndroidKeystoreDeviceKeyStore.kt:52-64` — `create()` generates into a fixed alias (`:72 "id.frak.sdk.identity"`) with no check-and-set; two processes racing first launch each generate, the second silently replaces the first's key.
  - `identity/AnonymousIdStore.kt:197` derives the id from the *loaded* key and memoises it, so process A keeps serving an id derived from a key that is no longer in the keystore.
  - `EventQueue.kt:286` `temp.renameTo(file)` — a compaction in one process silently discards rows another appended.
  - No guidance anywhere: grep for `process` in `sdk/android/README.md` / `PRIVACY.md` returns nothing.
- **What actually happens**: an app with an `android:process=":push"` service (common in large retail apps) that has `Frak.initialize` in `Application.onCreate` runs two SDKs. Attribution splits across two anonymous ids for the same install, and queued events are randomly lost on compaction. No error surfaces.
- **Fix sketch**: at minimum detect a non-default process in `initialize` (compare `Application.getProcessName()` to `packageName`) and log an error / no-op; document "initialize in the main process only".
- **Register status**: NEW

### F7. Register 9.2 (`percentDecode` truncation) is real but overstated — and there is a second, unfiled bug on the same three lines

- **Severity**: low
- **Axis**: correctness / docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - Confirmed: `net/UrlQuery.kt:96-98` — `if (byte == null) { out.write(char.code); index++ }`. `ByteArrayOutputStream.write(int)` keeps the low 8 bits of a UTF-16 code unit, so `名` (0x540D) is written as `0x4D`. Guarded by the `'%' !in value` fast path at `:89`, so it only bites a value containing at least one `%`.
  - Overstated: there are exactly **two** consumers of the decoded value in the whole SDK, and both are ASCII-by-contract — `sharing/SharingLinkBuilder.kt:40` (`fCtx`, base64url) and `identity/IdentityMerge.kt:29` (`fmt`, a JWT minted by `services/backend/src/domain/identity/services/AnonymousMergeService.ts:38`). The third caller, `UrlQuery.fillIfAbsent` (`:38 if (get(key) != null) return@apply`), uses the result only for a presence test, so corruption there is unobservable. The register's *"this feeds `fCtx` extraction and gap-fill"* is technically true and practically inert.
  - NEW on the same lines: `:95` `hex?.toIntOrNull(16)` accepts a sign, so `%-1` decodes to `toIntOrNull("-1", 16) == -1` → `out.write(-1)` → byte `0xFF`, and `%+f` → `0x0F`. A tolerant decoder should have rejected both and left them verbatim.
- **What actually happens**: today, nothing a merchant can see. It becomes real the first time a query value with human text is read back through `UrlQuery.get`.
- **Fix sketch**: iterate `value.toByteArray(UTF_8)` like iOS, and constrain the escape to two `isHexDigit` chars instead of `toIntOrNull`.
- **Register status**: overstated in 9.2 (severity), plus a NEW sign-acceptance bug in the same function

### F8. Proof timestamps are raw wall-clock: a device 61 s fast fails every proof, and 2 min slow fails every merge

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - `identity/AnonymousIdStore.kt:82` — `ts: Long = System.currentTimeMillis() / 1000`, used unchanged for both ops (`:86-87`).
  - `services/backend/src/domain/identity/services/IdentityProofService.ts:32` `MAX_FUTURE_SKEW_SECONDS = 60`, `:22` `"frak-merge-v1": 2 * 60`, `:63-64` `if (ts > now + MAX_FUTURE_SKEW_SECONDS) return false`.
  - The SDK never reads a server clock (`Date` response headers are unused; `net/HttpClient.kt:223` parses only `Retry-After`).
  - Failure is invisible client-side: `MergeSender.kt:54-56` logs `"Identity merge refused with status 403"` at WARN, and `FrakLogLevel` defaults to `NONE` (`core/FrakConfig.kt:139`).
- **What actually happens**: on a device whose clock is a couple of minutes off (no NTP, manual clock, some ROMs after a battery pull), `openFrakApp`/`installPageUrl` mint install proofs the backend drops, and every inbound merge 403s three times and is discarded (`EventOutbox.kt:134-139`). The user's referral is silently unattributed and there is no diagnostic at default log level.
- **Fix sketch**: capture `serverNowSeconds` from the HTTP `Date` header on any successful response, carry the offset, and stamp `ts` with it; log a WARN once when |offset| > 30 s.
- **Register status**: NEW

### F9. Duplicate delivery after a mid-drain process kill — the queue is reconciled once, at the end of the whole pass

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**: `tracking/EventOutbox.kt:165-220` loops over up to `MAX_EVENTS` rows POSTing each, accumulating `delivered` in memory; the single write-back is `:224-226` `queueMutex.withLock { queue.reconcile(delivered, retried, now()) }` after the loop ends.
- **What actually happens**: Android kills the process mid-drain (routine when the user swipes away or memory pressure hits). Every row already POSTed in that pass is on disk unchanged and is re-POSTed next launch. The blast radius is limited because the backend is idempotent for all three shapes — `services/backend/src/api/schemas/interactionSchemas.ts:5-6` (arrival keys on `referralLinkId`), `:21`/`:28` (`idempotencyKey` for sharing/custom), purchase on `(orderId, token)` — so the cost is redundant traffic plus a merge row burning its failure cap on an already-consumed single-use token. Note also that `services/backend/src/api/user/track/interaction.ts:61-64` asserts *"The native SDK keys its retry/idempotency handling off this flag [`isDuplicate`]"* — the Android SDK never reads the response body (`InteractionSender.kt:31` just calls `classifyStatus`), so that backend comment is false.
- **Fix sketch**: reconcile incrementally (every N rows, or after each `Delivered`), or write an intent record before the POST.
- **Register status**: NEW

### F10. A row captured with no anonymous id is enqueued anyway, 401s, and blocks the FIFO for three drains

- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `core/DefaultFrakClient.kt:238` `tracker.track(merchantId, identity.anonymousId(), interaction)` — a null id is passed straight through and stored (`EventOutbox.kt:250-270`).
  - `tracking/RowSender.kt:21-22` — `row.clientId?.let { mapOf("x-frak-client-id" to it) } ?: emptyMap()`, so the request goes out with no identity header.
  - `services/backend/src/api/user/track/sdkIdentity.ts:139-144` returns **401** `"x-frak-client-id or x-wallet-sdk-auth header required"`.
  - `tracking/RowSender.kt:29-42` maps 401 to `Rejected`; `EventOutbox.kt:201-204` then `break`s the drain, so the dead row stays at the head and stops everything behind it, for three drains, before being dropped.
- **What actually happens**: on a device where the keystore refuses (`AnonymousIdStore.kt:202-206` logs and returns null), the SDK keeps queueing unsendable rows and each one stalls the queue head. Attribution is already lost on such a device; this adds pointless 401 traffic and head-of-line blocking.
- **Fix sketch**: refuse the enqueue when `anonymousId()` is null (return `FrakResult.Failure`), or drop a null-clientId row at drain time like `MergeSender.kt:24-28` already does.
- **Register status**: NEW

### F11. `resetAnonymousId()` returns before the purge runs, and the purge clears events captured under the *new* id

- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `core/DefaultFrakClient.kt:115-122` — `val erased = identity.reset(); if (erased) { scope.launch { tracker.purge() } }; return erased`. `EventOutbox.purge()` (`:93-95`) is `queue.clear()` — the whole file, unfiltered by client id.
- **What actually happens**: a merchant who calls `resetAnonymousId()` then immediately tracks an event can have that event deleted by the detached purge. Also, the caller has no way to know when the purge finished. Low frequency, but the KDoc at `FrakClient.kt:38-45` implies a completed rotation.
- **Fix sketch**: `tracker.purge()` inside the suspend body instead of `scope.launch`, and purge by `clientId` rather than truncating the file.
- **Register status**: NEW

### F12. Frozen ABI: reward read models keep public constructors, so any new backend field is a merchant-breaking change

- **Severity**: low
- **Axis**: build-release
- **Complexity to fix**: small (<1d), but only before the first publish
- **Evidence**: `frak-sdk/api/frak-sdk.api:471` `BestReward.<init>(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/Double;Ljava/lang/Double;ZLjava/util/List;)V`, `:485` `Campaign.<init>` (8 args), `:601` `TokenAmount.<init> (DDDD)V`, `:503/511/522/531` the `EstimatedReward` arms, `:581/591` the `RewardTier` arms. Contrast the config tree, which took `internal` constructors (`config/FrakResolvedConfig.kt`, dump shows getters only, `:127-197`). The rationale is recorded in `README.md` ("a merchant does build one — for a `@Preview`") and the arity freeze is acknowledged there, but the decision is still open per A3/09.
  Two smaller traps in the same dump: `Frak.shutdown` is the one member that is **not** static (`:25` `public final fun shutdown` vs `:22/26` `public static final`), an inconsistency a Java caller meets as `Frak.INSTANCE`; and `FrakResult` (`:418-429`) has no accessors, so every Java call site writes an `instanceof` chain to read a `Unit`.
- **What actually happens**: the day the backend adds a field to `estimated-rewards`, bumping the SDK is a `NoSuchMethodError` in any merchant binary that constructed a `BestReward` — unfixable by the merchant, because it is their shipped app.
- **Fix sketch**: give the reward models `internal` constructors + a `@VisibleForTesting`/preview factory, matching the config tree; decide before the first Central release, not after.
- **Register status**: confirms A3/D7 (open item), NEW for the `shutdown` staticness nit

### F13. `DeepLinkObserver` writes into the merchant's `Intent` and inspects every activity's data URI

- **Severity**: nit
- **Axis**: UX/DX
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `applink/DeepLinkObserver.kt:27` `intent.putExtra(HANDLED_EXTRA, true)` mutates an object the merchant owns and may re-`Parcel`; `:26` forwards *any* activity's `intent.data` (a `content://` from a share target, the merchant's own custom scheme) into `handleReferralLinkInBackground`.
- **What actually happens**: benign today — `handleReferralLink` (`core/DefaultFrakClient.kt:261-266`) returns early when there is no `fCtx`/`fmt`. But the SDK is silently adding an extra to intents a merchant may forward, log or compare.
- **Fix sketch**: keep the handled-set in the observer (an `IdentityHashMap<Intent, Unit>` or a per-activity tag) instead of writing into the merchant's Intent.
- **Register status**: NEW

## Verified-OK

- **Proof wire format matches the frozen TS contract**: `identity/ProofCodec.kt:65-107` (`op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8)`, envelope `v(1) ‖ pk(65) ‖ ts(8) ‖ sig(64)`, unpadded base64url) is byte-identical to `sdk/core/src/identity/canonical.ts:15-52`; UUIDs are parsed not lowercased (`core/Uuid.kt:13-22`), and `deriveClientIdFromHash` (`:54-62`) sets the same RFC-4122 bits the backend derives with (`IdentityProofService.ts:56-59`).
- **P-256 / non-exportable / no user-auth**: `AndroidKeystoreDeviceKeyStore.kt:53-61` — `KEY_ALGORITHM_EC` + `secp256r1` + `PURPOSE_SIGN` + `DIGEST_SHA256`, no StrongBox (correct: `setIsStrongBoxBacked` would throw on most devices), no `setUserAuthenticationRequired` (correct for background paths).
- **Keystore failure never crashes the host**: `ProviderException`/`KeyStoreException`/`UnrecoverableKeyException` all land in `AnonymousIdStore.kt:202-206` (`catch (failure: Exception)`), a refusal is not cached (`:163-165` clears `generation` only if it is still the same `Deferred`), and `CancellationException` is rethrown (`:198-201`).
- **DER→raw signature conversion** (`identity/DeviceKey.kt:57-75`) validates the tag/length/trailing bytes and strips DER sign padding correctly; low-S is deliberately not normalised, matching `canonical.ts:47-52`.
- **`x-frak-client-id` is the right header** for `/user/track/*` (`services/backend/src/api/user/track/sdkIdentity.ts:7-12`), and it carries the *capture-time* id, not the current one (`RowSender.kt:20-22`, `EventOutbox.kt:173-176`).
- **Merge hold budget matches the token TTL**: `MergeSender.kt:16` 60 min vs `AnonymousMergeService.ts:36` `Date.now() + 60*60*1000`; the merge proof is minted per attempt (`MergeSender.kt:39-41`), so the 2-minute `frak-merge-v1` window is not consumed by queue latency; binding is `SHA-256(utf8(token))` (`IdentityMerge.kt:32-33`) matching `IdentityProofService.hashMergeToken`.
- **HTTP bounds**: connect 3 s / read 5 s inside a 20 s wall-clock deadline (`net/HttpClient.kt:254-258`), `instanceFollowRedirects = false` (`:165`), 1 MiB cap enforced both on `Content-Length` and on a streamed 8 KiB read (`:181-187`, `:200-220`), 204/205/304 handled without touching `inputStream` (`:188-193`), `Retry-After` clamped to `[1, 300]` (`:223-227`), one retry only on GET and only for a transient allowlist with jitter (`:60-83`), and logging never emits the query string or a header (`:127-138`).
- **JSON**: `org.json` is the parser (platform-provided, test-only dependency in `frak-sdk/build.gradle.kts:24`) — not hand-rolled, so the deep-nesting/huge-number/unicode-escape questions are AOSP's; `JsonReader` adds finite-number enforcement (`net/JsonReader.kt:48-72`) and type-safe `opt` casts rather than coercing getters.
- **`Base64Url` / `Hex`**: correct unpadded RFC 4648 §5, `length % 4 == 1` rejected, non-zero trailing bits rejected (`core/Base64Url.kt:51-74`); `Hex.decodeOrNull` rejects odd length and non-hex.
- **Config cache**: clock-skew-safe freshness (`ConfigStore.kt:68-71`, `elapsed in 0 until TTL`), per-fetch sequence number gating the publish so a late fetch cannot overwrite a newer one (`:132`, `:152-157`), corrupt persisted envelope discarded and removed (`:219-224`), cache invalidated across SDK versions (`:215`).
- **Backoff** is per key, exponential with a shift cap, jittered to `[d/2, d]`, and treats `Retry-After` as a floor rather than a replacement (`config/Backoff.kt:44-54`); entries are dropped on read so the map cannot grow (`:32-41`).
- **`SingleFlight`** completes waiters even when `scope.launch` never runs the body or throws outright (`config/SingleFlight.kt:48-68`) — the two failure modes that would otherwise hang every caller.
- **Consent**: a read failure is *not* memoised and answers `false` (`core/TrackingConsent.kt:42-55`); `FrakConfig.trackingEnabled(false)` is a floor no runtime grant can lift (`:30`, `:82-87`); the drain re-checks per event (`EventOutbox.kt:150`, `:168-171`).
- **`shutdown()` is sound**: one `SupervisorJob` parents every background coroutine including the `asFuture` twins and the identity mint (`DefaultFrakClient.kt:69-76`, `:104-107`, `:148`), and `cancelAndJoin` (`:143`) waits for the drain to unwind; `Frak.shutdown` clears the session and unregisters the observer outside the lock (`Frak.kt:128-137`).
- **`asFuture` threading**: `CoroutineStart.UNDISPATCHED` + `withContext(ioDispatcher)` means no main-thread I/O and completion on the main looper (`DefaultFrakClient.kt:104-107`, `core/MainThreadDispatcher.kt:19-28`), and the looper-exiting path cancels instead of hanging.
- **`FrakEnvironment.Custom`** origin allowlist (https, or http to loopback/RFC-1918/`*.local`/`10.0.2.2`) with a placeholder substitution and an `initialize`-time error log (`core/FrakEnvironment.kt:76-134`, `Frak.kt:69-71`); production wallet package id/scheme match `packages/wallet-shared/src/common/utils/storeUrls.ts:7-8` and `sdk/core/src/constants.ts:15`.
- **Manifest hygiene**: no `QUERY_ALL_PACKAGES`, only the two `<package>` queries, only `INTERNET`, no exported components (`frak-sdk/src/main/AndroidManifest.xml`); consumer ProGuard file is deliberately empty and explains why.
- **Self-referral / foreign-merchant guard** runs at capture *and* at drain once the merchant is known (`applink/ReferralArrival.kt:13-29`, `tracking/InteractionSender.kt:39-45`) — register 3.2's closure is accurate.
- **Products encoding** is deterministic (fixed alphabetical field order, integral doubles without `.0`, control chars escaped) and length-capped to the backend's `PRODUCTS_PARAM_MAX_LENGTH` (`rewards/RewardRepository.kt:171-206`, `:258-267`).

## Could not verify

- Whether `ktlintCheck` actually fails on F3 (no JDK/Gradle here) — the rule is default-on and unconfigured, but I could not execute it.
- Whether `AndroidKeystoreDeviceKeyStore` recovers as designed on a device with a full/corrupt keystore: register 8.5 is right that it has zero executed coverage anywhere, and the JVM stub `android.jar` makes it untestable here too.
- Play Store install-referrer length limits for `InstallLinks.playStore` (`applink/InstallLinks.kt:32-45`) — merchantId + anonymousId + a 184-char base64url proof, percent-encoded, is a long `referrer`; whether Play truncates it, and whether the wallet app even reads the Install Referrer API, is outside this module.
- Actual ANR/jank magnitude for F5 — no device, so the file sizes and parse costs are reasoned, not measured.
- `org.json`'s AOSP behaviour on pathological input (deep nesting, `1e999`) versus the JVM `org.json:json` used in tests; `JsonReader` guards non-finite numbers but the platform parsers are known to differ, and only the JVM one is exercised by the suite.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "13 findings written to /tmp/frak-audit/android-core.md, each with severity, axis, path:line evidence and a fix sketch; ranked worst-first, plus a Verified-OK coverage list and an explicit could-not-verify list."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "rg/grep/find/sed over sdk/android/frak-sdk, sdk/ios, services/backend, sdk/core, example/native-android",
      "result": "passed",
      "summary": "Read-only source inspection; no repo file modified. No JDK/Gradle/Swift available, so nothing was compiled or executed."
    }
  ],
  "validationOutput": [
    "Register cross-checks: 9.2 CONFIRMED as a real defect but severity overstated (only two ASCII-by-contract consumers of UrlQuery.get); 9.4 CONFIRMED (no drain coalescing, EventOutbox.kt:69,86,111); 3.2 closure CONFIRMED accurate; A3/D7 arity freeze CONFIRMED still open on the reward models.",
    "Cross-repo contract checks: ProofCodec.kt vs sdk/core/src/identity/canonical.ts byte layout identical; x-frak-client-id matches services/backend/src/api/user/track/sdkIdentity.ts; MergeSender hold budget matches AnonymousMergeService.ts 60-min TTL; wallet package ids match packages/wallet-shared/src/common/utils/storeUrls.ts."
  ],
  "residualRisks": [
    "F3 (unused StateFlow import → ktlint) could not be executed here; if CI is currently green the lint gate itself is suspect. Verify with `bun run --cwd sdk/android lint`.",
    "F1's severity assumes the merchant does not call setIntent() in onNewIntent; the project's own harness does not, and nothing documents it, but a device pass is the only way to close it.",
    "AndroidKeystoreDeviceKeyStore's damaged-entry and ProviderException paths remain unexecuted on any machine (register 8.5) — my analysis of them is static only.",
    "F5's performance impact is reasoned from code, not measured on a device.",
    "I did not audit sharing/ (FrakContextCodec, SharingLinkBuilder, SharingRequest) beyond what handleReferralLink depends on, nor frak-sdk-ui."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repo changes. One artifact written outside the repo: /tmp/frak-audit/android-core.md",
  "reviewFindings": [
    "blocker: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/DeepLinkObserver.kt:23-29 - DeepLinkHandling.Automatic (the default) reads activity.intent, so a warm-start deep link delivered via onNewIntent is never seen unless the merchant calls setIntent(); the file's own KDoc claims otherwise and example/native-android/MainActivity.kt:237-240 gets it wrong on a singleTask activity",
    "high: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt:151 - no retry driver for the outbox (no timer, no foreground hook, no connectivity callback); events stranded after one transient failure until the next track() or process start. iOS has DefaultFrakClient.swift:123-132",
    "high: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:39 - unused `import kotlinx.coroutines.flow.StateFlow`; ktlint standard:no-unused-imports is default-on, so `check`/CI should be red (or the lint gate is not covering this source set)",
    "medium: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/Frak.kt:91 - context.noBackupFilesDir does main-thread disk I/O inside initialize, contradicting the 'does no I/O' KDoc at Frak.kt:49; StrictMode penaltyDeath kills merchant debug builds",
    "medium: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventQueue.kt:336 - queue capped by row count only, custom event payloads unbounded, and every track() re-reads/re-parses the whole file (compounded by the 9.4 coalescing gap)",
    "medium: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/identity/AndroidKeystoreDeviceKeyStore.kt:52-64 - no multi-process guard: two processes race the keystore alias and share an unsynchronised JSONL queue, splitting the anonymous id and losing rows on compaction",
    "medium: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/identity/AnonymousIdStore.kt:82 - proof ts is raw System.currentTimeMillis; backend allows 60s future skew and a 2-minute merge window, so a mis-set clock silently kills install proofs and merges with no default-level log",
    "medium: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt:224 - reconcile runs once at end of drain, so a mid-drain process kill re-POSTs every already-delivered row (backend idempotency absorbs most of the harm)",
    "low: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/UrlQuery.kt:96-98 - register 9.2 confirmed (char.code truncation) but overstated: both real consumers are ASCII-by-contract. New adjacent bug: toIntOrNull(16) accepts a sign, so %-1 writes 0xFF",
    "low: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:238 - rows with a null anonymous id are enqueued, 401 at the backend, and block the FIFO head for three drains",
    "low: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:119 - resetAnonymousId returns before the detached purge runs, and the purge clears the whole file including events captured under the new id",
    "low: sdk/android/frak-sdk/api/frak-sdk.api:471,485,601 - reward read models keep public constructors, freezing their arity; a new backend field becomes NoSuchMethodError in shipped merchant binaries",
    "nit: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/DeepLinkObserver.kt:27 - the SDK writes a marker extra into the merchant's Intent and inspects every activity's data URI"
  ],
  "manualNotes": "Two cheap local checks would resolve the two highest-leverage uncertainties: (1) `bun run --cwd sdk/android lint` for F3; (2) an emulator warm-start deep link against example/native-android for F1 — add `setIntent(intent)` to the harness's onNewIntent and watch the behaviour change, which is itself the proof. Also worth noting for the parent: services/backend/src/api/user/track/interaction.ts:61-64 asserts the native SDK keys retry handling off the `isDuplicate` response flag; the Android SDK never reads a track response body, so that backend comment is stale."
}
```
