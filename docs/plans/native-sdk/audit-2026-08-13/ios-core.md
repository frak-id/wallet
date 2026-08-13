# iOS core target audit — `sdk/ios/Sources/FrakSDK`

Worktree `/home/dev/wallet-audit` @ `c0a0cec`. Read-only, no build/test run (no Swift toolchain). All claims are from reading source; backend cross-checks against `services/backend/src`.

## Summary

The core target is unusually careful code — the durable outbox, the `fCtx`/proof codecs, the SWR config cache, the identity split onto a backup-excluded file with an explicit `afterFirstUnlock` protection class are all better than typical alpha SDK work, and most of the register's iOS rows check out as written. It is *not* yet alpha-ready, and the single worst thing is not any of the filed rows: **a row that reaches the queue with `clientId == nil` (identity not yet readable, or key minting failed) is still uploaded, the backend answers 401 for a missing `x-frak-client-id`, the drain classifies 401 as `.rejected`, `break`s the whole drain, and drops the row after 3 passes** — a silent, guaranteed loss of interactions *and purchases* that also stalls every event behind it (F1). Second worst is merchant-setup: the merchant-facing README never mentions `LSApplicationQueriesSchemes` or Universal Links/AASA, both of which the design docs already say are mandatory integration steps, so the Moulinex integration would ship with `isFrakAppInstalled()` permanently false and inbound `fCtx` links that never reach the app (F2).

Register verification: 9.17's "multicast, replay-latest, deduped" is **two-thirds true and overstated on replay** — a warm start served from a <5 min disk cache publishes nothing and replays nothing, pinned by the SDK's own test (F4). N4/5.7 and S5/3.7 are **confirmed as written** (F6, F9). 9.7 is **confirmed and understated** — three more escape hatches exist than it lists (F5). `Frak.initialize`'s own "no I/O" contract is false (F3), and `sdk/ios/README.md` contradicts itself about CI in the same file (F7).

## Findings

### F1. Events captured with no anonymous id are sent anyway, 401 forever, block the queue, then get dropped
- **Severity**: high
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - Capture never gates on having an id: `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:289` `clientId: await identity.anonymousId()` (nil-able), and the design is explicit at `sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift:35-37`: *"Gates the drain, never capture: a row captured in that window carries no client id and **lands unattributed**, where gating capture too would drop it entirely."*
  - Sender omits the header entirely for a nil id: `sdk/ios/Sources/FrakSDK/Tracking/RowSender.swift:17-19` `row.clientId.map { ["x-frak-client-id": $0] } ?? [:]`, used by `Tracking/InteractionSender.swift:31` and `Tracking/PurchaseSender.swift:22`.
  - Backend does **not** accept an unattributed track: `services/backend/src/api/user/track/sdkIdentity.ts:140-144` returns `statusCode: 401, "x-frak-client-id or x-wallet-sdk-auth header required"`; both `api/user/track/interaction.ts:19-24` and `api/user/track/purchase.ts:31-38` propagate it.
  - 401 is not retryable and not tolerated: `Tracking/RowSender.swift:24-28` (`429`/`5xx` only ⇒ `.retryable`, everything else ⇒ `.rejected`), `Tracking/EventOutbox.swift:299-307` (`.rejected` ⇒ failure++, `break eventLoop`), `Tracking/EventOutbox.swift:15` `maxFailures = 3`.
  - `MergeSender` already does the right thing for the same input (`Tracking/MergeSender.swift:17-20`, drops a merge row with no anonymous id) — so the policy is inconsistent within the same layer.
- **What actually happens**: the app is launched into a locked, not-yet-unlocked device (post-reboot background launch, push handler, `BGAppRefresh`), or Secure Enclave key creation fails once (`Identity/AnonymousIdStore.swift:180-186` logs and returns nil). Every `track()`/`trackPurchase()` in that window lands on disk with `clientId: nil`. Once the device unlocks, `identityReadable` opens the drain (`Tracking/EventOutbox.swift:237`), a *new* id is minted, and the orphan rows are posted with no identity header: 401 → `.rejected` → the drain `break`s, so **every later, perfectly good event waits behind them** for three drain passes, and the orphans are then discarded with a `warn`. A purchase captured in that window is money lost with no merchant-visible error (`track` already returned `.success`).
- **Fix sketch**: treat a nil `clientId` as `.hold` in `InteractionSender`/`PurchaseSender` (the mechanism already exists for a missing merchantId) and stamp the current id at drain time when the row was captured without one; or refuse the enqueue and return `.failure(.internalFailure)` so the caller knows.
- **Register status**: NEW.

### F2. Merchant-facing README omits the two Info.plist/entitlement steps the SDK cannot do for the merchant
- **Severity**: high
- **Axis**: merchant-setup
- **Complexity to fix**: trivial (<1h) for the docs; the missing capability is the merchant's
- **Evidence**:
  - `sdk/ios/README.mirror.md:75-84` is the whole inbound-link section: it says only "wire `.onOpenURL`". No Associated Domains, no `apple-app-site-association`, no `LSApplicationQueriesSchemes`, no URL-scheme registration.
  - The SDK *knows* the requirement and states it only in code: `sdk/ios/Sources/FrakSDK/AppLink/AppLauncher.swift:12-13` "canOpen needs the wallet's scheme in `LSApplicationQueriesSchemes` or it answers false for an installed app"; `sdk/ios/Sources/FrakSDK/AppLinkAPI.swift:19`; `Core/FrakEnvironment.swift:44-45`.
  - The plan already ruled it a required, documented step: `docs/plans/native-sdk/02-sdk-design.md:123-125` "iOS has no merger, so `LSApplicationQueriesSchemes` must be a documented integration step."
  - The harness does declare it (`example/native-ios/project.yml:36-38` comment + its `Info.plist`), so the only integration that works is the one nobody ships.
  - Share links are ordinary merchant https URLs (`Sources/FrakSDK/Sharing/SharingLinkBuilder.swift:32-42` appends `fCtx` to the merchant's own URL) — reaching `.onOpenURL` at all requires Universal Links on the merchant's domain, documented nowhere in either README.
- **What actually happens**: Moulinex integrates per the README. `appLink.isFrakAppInstalled()` returns false on a device that has the wallet installed (and the console fills with `canOpenURL: failed for URL "frakwallet://" — This app is not allowed to query for scheme frakwallet`), so the install handoff always takes the store path even for existing wallet users. Separately, every shared link opens Safari instead of the app, so no arrival is ever tracked and the referral loop silently never closes — with no error anywhere to diagnose it.
- **Fix sketch**: add an "Integration checklist" to `README.mirror.md`: `LSApplicationQueriesSchemes` (`frakwallet`, `frakwallet-dev`), Associated Domains + AASA for the domains you put in share links, and where `handleReferral` must be called; ideally log a one-time `.warn` at init when `Bundle.main` lacks the query scheme.

### F3. `Frak.initialize` documents "no I/O" but does synchronous filesystem work on the caller's thread — twice
- **Severity**: medium
- **Axis**: correctness / docs-accuracy
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDK/Frak.swift:15` — "// Non-blocking, no I/O, never throws."
  - `Frak.swift:46` → `FileKeyValueStore.makeDefault` → `Config/FileKeyValueStore.swift:34` `FrakStorage.directory()`.
  - `Frak.swift:71` → `EventQueue.defaultFileURL` → `Tracking/EventQueue.swift:171` `FrakStorage.directory()` again.
  - `Core/FrakStorage.swift:14-27`: `FileManager.url(..., create: true)` + `createDirectory` + `setResourceValues(isExcludedFromBackup)` — three synchronous syscalls (one an xattr write), executed twice per initialize, while `Frak.lock` is held (`Frak.swift:31-32`).
- **What actually happens**: the documented call site is `application(_:didFinishLaunchingWithOptions:)`, i.e. the main thread during launch, where the watchdog budget is measured. It is small, but it is a filesystem write on the launch path, contradicting the contract the SDK advertises, and on a device whose container is momentarily unavailable it silently degrades to `missingIdentityStore` — `Frak.swift:91-98` logs at `.error` and **the SDK does not initialize at all**, so every later `try Frak.client` throws `notInitialized` with the reason buried in a log line the merchant has probably not enabled (`logLevel` defaults to `.none`, `Core/FrakConfig.swift:92`).
- **Fix sketch**: hoist the directory preparation into the already-existing `startupTask` (or make `FileKeyValueStore`/`EventQueue` create their directory lazily on first write, which `EventQueue.createDirectory()` already does), and correct the comment.
- **Register status**: NEW.

### F4. `ConfigAPI.updates` does not replay on the dominant warm-start path — its own doc and 9.17 say it does
- **Severity**: medium
- **Axis**: docs-accuracy / DX
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - Public promise: `sdk/ios/Sources/FrakSDK/ConfigAPI.swift:12` — "/// Multicast, replays latest value to new subscribers."
  - Replay source is `lastPublished`, written only inside `fetch` (`Config/ConfigStore.swift:76-87`, `:188-196`); the disk-hydration path `readCache`/`readPersisted` (`ConfigStore.swift:150-155`) never publishes, and a fresh (<5 min) cache returns before any fetch (`ConfigStore.swift:128-132`).
  - The behaviour is deliberately pinned by the suite: `sdk/ios/Tests/FrakSDKTests/Config/ConfigStoreTests.swift:343-345` ("`updates` stays empty, since `fetch` is the only publish point and a fresh-cache resolve never reaches it") and the assertion at `:436-439` "currentConfig's disk hydration must not publish to the stream".
  - Dedup on equality (`ConfigStore.swift:188`) means an unchanged config after revalidation publishes nothing either.
- **What actually happens**: a merchant renders sheet copy/reward text from `for await config in client.config.updates` (the shape the API invites). On the second and every subsequent app launch inside the 5-minute freshness window, the stream emits **nothing at all** for the whole session and the UI stays empty, while `config.current` would have answered instantly. This is the same warm-start lie 9.17 cites as the reason Android's `updates` was deleted.
- **Fix sketch**: publish (or at least seed `lastPublished`) on the disk-hydration path in `readCache`, or reword `ConfigAPI.updates` to "emits on change only; use `current` for the initial value" and say so in the merchant README.
- **Register status**: overstated in 9.17 (the "replay-latest" half; multicast, dedup and background-revalidation feeding all verify correctly).

### F5. Exactly what survives `shutdown()` — five escapes, not the four the register names
- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: medium (few days — needs a structured task tree)
- **Evidence**: `shutdown()` cancels only what `DefaultFrakClient` retains (`DefaultFrakClient.swift:182-192`: `startupTask`, `configFlushTask`, `foregroundTask`, `tracker.shutdown()`). Surviving unstructured tasks, complete list:
  1. `Config/ConfigStore.swift:229` — background revalidation `Task { … singleFlight.run … }` (network).
  2. `Config/SingleFlight.swift:115` — the shared flight task itself (network; deliberately not cancelled, `SingleFlight.swift:93-94`), plus the per-waiter relay `Task` at `:95` and the eviction `Task` at `:123`.
  3. `Identity/AnonymousIdStore.swift:152` — `Task.detached(priority: .userInitiated)` doing keystore/Secure Enclave work.
  4. `DefaultFrakClient.swift:154` — `Task { await tracker.purge() }` from `resetAnonymousId` (disk).
  5. `Config/ConfigStore.swift:84` — the `onTermination` cleanup `Task` (harmless).
  Additionally: `ConfigStore.subscribers` continuations are never `finish()`ed (`ConfigStore.swift:61`, no teardown anywhere), and `HTTPClient.defaultSession` is a process-lifetime static (`Net/HTTPClient.swift:63-70`) that is never `invalidateAndCancel()`ed.
- **What actually happens**: after `await Frak.shutdown()` returns, an HTTP request can still be in flight (config revalidation or any single-flighted resolve/rewards fetch), and a merchant awaiting `for await c in client.config.updates` **never terminates** — the loop hangs for the process lifetime rather than ending, which is the natural way a SwiftUI `.task` is written.
- **Fix sketch**: give `DefaultFrakClient` a `TaskGroup`/`taskRegistry` that `ConfigStore`/`AnonymousIdStore` launch into, and `finish()` all `updates` continuations in `shutdown()`.
- **Register status**: confirms 9.7 (and it is understated: `SingleFlight`'s three tasks and the never-finished stream are not listed; `RewardRepository` has no `Task` of its own — it escapes only via `SingleFlight`).

### F6. Peak memory during a response read is genuinely unbounded (S5 confirmed verbatim)
- **Severity**: medium
- **Axis**: security / performance
- **Complexity to fix**: medium (few days)
- **Evidence**: `Net/HTTPClient.swift:226-247`. `let (data, response) = try await session.data(for: request, delegate: redirectDelegate)` buffers the entire body before either cap runs; `expectedContentLength` is `-1` for a chunked response (`:237-242`), and the real check `Int64(data.count) > maxResponseBodyBytes` (`:243`) fires only after the allocation. The file says so itself at `:227-232`.
- **What actually happens**: a backend bug, a compromised backend, or a captive-portal/plaintext `.custom` origin (`FrakEnvironment` allows `http://` to private hosts, `Core/FrakEnvironment.swift:85-90`) answering a chunked multi-hundred-MB body will grow the merchant's app until iOS jetsams it. The 1 MiB cap only stops the oversized body from being *persisted*, not from being *allocated*.
- **Fix sketch**: implement a `URLSessionDataDelegate` that accumulates `didReceive data` and calls `completionHandler(.cancel)` past the cap — the delegate object already exists here (`NoRedirectDelegate`), so no `session.bytes(for:)` suspension storm is needed.
- **Register status**: confirms S5 / 3.7 (accurate as written, including the reason the streaming rewrite was reverted).

### F7. `sdk/ios/README.md` contradicts itself and is stale in four places
- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/ios/README.md:155` — "No CI builds either native SDK." vs `sdk/ios/README.md:89-92` in the same file and `.github/workflows/apps.yaml:177-208` (`ios-sdk` job runs lint/build/test).
  - `README.md:80` — "257 Swift Testing tests"; `docs/plans/native-sdk/06-open-findings.md:5` counts 396 in 42 suites.
  - `README.md:55` — target table still names `InteractionTracker`; the type is `EventOutbox` (`Sources/FrakSDK/Tracking/EventOutbox.swift:9`).
  - `README.md:86-87` — "Not implemented: … the install-code + pasteboard + `SKStoreProductViewController` handoff"; implemented as `Sources/FrakSDKUI/NativeShare.swift:65-68` (`copyInstallCode`) and `Sources/FrakSDKUI/StoreOverlay.swift:26-40` (`SKOverlay`, not `SKStoreProductViewController`).
  - `README.md:47-58` is headed "Public API surface" but lists `HTTPClient`, `ConfigStore`, `KeyValueStore`, `SingleFlight`, `Backoff`, `MerchantQuery`, `EventQueue`, `AnonymousIdStore`, `Base64URL`, `Hex`, `DefaultFrakClient` — every one of which is `internal` (e.g. `Core/Base64URL.swift:6`, `Config/ConfigStore.swift:15`, `DefaultFrakClient.swift:7`).
  - Minor: `README.mirror.md:17` shows `exact: "0.1.0-alpha.1"` while `Sources/FrakSDK/FrakSDKVersion.swift:3` is `"0.0.1"` (the release workflow gates tag↔version, `.github/workflows/release-ios-sdk.yml:68-75`, so the README example is simply unpublishable as written).
- **What actually happens**: the file a contributor reads to decide whether CI covers a change says it does not; a merchant reading the surface table believes `HTTPClient` is substitutable API when D3/D4 already record that it is not.
- **Fix sketch**: delete line 155, refresh the counts/names, retitle the table "Internal layout" and list only the genuinely `public` types.
- **Register status**: NEW (B3 mentions the version pair, not the README contradiction).

### F8. The install-code pasteboard carrier silently overwrites the user's clipboard, and the "no prompt" claim is unverified
- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: medium (few days — needs a device pass + a wallet-side contract)
- **Evidence**:
  - `Sources/FrakSDKUI/NativeShare.swift:65-68`: `UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: code]], options: [.localOnly: true, .expirationDate: …])` — `setItems` replaces the entire pasteboard.
  - It is not driven by a user copy gesture: `Sources/FrakSDKUI/SharingSheetModel.swift:312-314` writes on the page's `.code` action (`// The SDK owns the pasteboard`), and the wallet page itself says the code lands "on the pasteboard even if they never tapped copy" (`apps/wallet/app/module/install/component/InstallView.tsx:426`).
  - The no-prompt reasoning (`NativeShare.swift:59-64`) depends entirely on the *receiving* app reading via QuickType, which the wallet does implement (`packages/wallet-shared/src/common/component/CodeInput/index.tsx:44-45,179-181` — `autoComplete="one-time-code"` + focus, "never a programmatic clipboard read"), but its fallback paste button *does* read programmatically (`index.tsx:141-146` `navigator.clipboard.readText()` / Tauri `readText`).
  - Store handoff: `Sources/FrakSDKUI/StoreOverlay.swift:26-40` raises `SKOverlay` on the window scene, `:42-49` dismisses; `SharingSheetModel.swift:168-171` dismisses on release. Structurally sound, Mac Catalyst excluded.
- **What actually happens**: a user who had something on their clipboard loses it to a 6-character code they never asked to copy. If the QuickType suggestion does not appear (it is heuristic, and nothing here is device-verified — `docs/plans/native-sdk/06-open-findings.md:22` T3), the only route is the wallet's paste button, which on iOS 16+ shows *"Frak Wallet would like to paste from My Moulinex"* — an alarming, merchant-named permission prompt at the exact moment of a first-run install handoff. There is no fallback that shows the code as selectable text if the paste path is refused.
- **Fix sketch**: write the pasteboard only on an explicit copy tap (or after the store overlay is actually raised), and make the wallet's install screen render the code as visible text so a refused paste is recoverable.
- **Register status**: NEW.

### F9. Three timeout mechanisms remain, and the 60s backstop is now the leak, not the budget (N4 confirmed)
- **Severity**: low
- **Axis**: performance / correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `Net/HTTPClient.swift:55` `overallDeadlineSeconds = 20` (the authoritative one, `:100`/`:123` via `Deadline.run`), `:61` `sessionBackstopSeconds = 60` applied to both `timeoutIntervalForRequest` and `timeoutIntervalForResource` (`:65-66`). `Net/Deadline.swift:14-25` cancels the losing child via `group.cancelAll()`.
- **What actually happens**: as the register says, they no longer compete for a budget. The residual cost is real though: when `Deadline` fires, the caller gets its error at 20 s but the underlying `URLSessionTask` is only *cancelled*, and a genuinely wedged connection holds a socket and its buffered body for up to 60 s more, per abandoned request — on a flaky mobile network during a burst drain that is several sockets outliving their callers. `HTTPClient.defaultSession` is never invalidated (see F5), so nothing sweeps them.
- **Fix sketch**: lower the backstop to ~25–30 s so it is still never the mechanism that fires but bounds the abandoned-socket tail.
- **Register status**: confirms N4 / 5.7 (accurate as written).

### F10. `URLQuery.percentDecode` does not treat `+` as a space, unlike the `URLSearchParams` it mirrors
- **Severity**: low
- **Axis**: parity
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `Net/URLQuery.swift:90-108` handles only `%XX`; the doc at `:54-56` justifies decoding by pointing at the web's `URLSearchParams`, which additionally maps `+` → space in a query component.
- **What actually happens**: a channel that form-encodes a shared link (mail clients and some link shorteners do) turns a space in `utm_campaign`/`utm_content` into `+`; the web listener sees the space, iOS sees a literal `+`, and the two platforms attribute the same click to two different campaign strings. The base64url `fCtx` payload itself is unaffected (no `+` in the alphabet), so this is attribution noise, not breakage.
- **Fix sketch**: map `+` to `0x20` before the `%` pass in `percentDecode`, and add a golden case.
- **Register status**: NEW (adjacent to 9.2, which covers the Android side of the same function).

### F11. No SDK-side dedup of an inbound arrival URL, unlike merge tokens
- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**: `DefaultFrakClient.swift:311-339` — the merge half is claimed exactly once (`Identity/IdentityMerge.swift:44-46` + the on-disk `isQueued` guard at `Tracking/EventOutbox.swift:130`), but the arrival half has no equivalent: `handleReferralLink` tracks an arrival every time it is called with the same URL. SwiftUI delivers `.onOpenURL` to *every* view that registers the modifier.
- **What actually happens**: a merchant who puts `.onOpenURL` on two views (or calls it from both `onOpenURL` and their own router, both of which the README suggests) enqueues N arrivals per link. The backend absorbs it (`services/backend/src/api/schemas/interactionSchemas.ts:5-6` — arrival keys on the upstream `referralLinkId`), so this costs requests and queue slots rather than double payouts.
- **Fix sketch**: keep a small in-memory `Set` of consumed `fCtx` payloads next to `IdentityMerge.consumed`.
- **Register status**: NEW.

### F12. A trapping `FrakLogSink` takes the merchant's app down, from inside SDK actors
- **Severity**: low
- **Axis**: DX
- **Complexity to fix**: trivial (<1h) — as far as Swift allows
- **Evidence**: `Core/FrakLogger.swift:11-13` (non-throwing protocol requirement), `:51-54` (called directly, no isolation of failure); the contract is stated only in a comment at `:3-10` including "an uncaught trap inside it brings down the host process". Call sites are inside actors, e.g. `Config/ConfigStore.swift:215`, `Tracking/EventQueue.swift:206`, so a slow sink also serialises SDK work.
- **What actually happens**: a merchant's logging adapter that force-unwraps or asserts crashes the app from a background actor with a Frak frame on the stack. Swift cannot catch a trap, so the only mitigation is documentation plus keeping sink invocation off the hot actors.
- **Fix sketch**: document it in `README.mirror.md` (currently absent there entirely) and hop sink delivery onto a dedicated detached task so at least the SDK's own actors are not blocked.
- **Register status**: confirms Q4 (accurate; note the merchant-facing README does not mention `FrakLogSink` at all).

### F13. `Package.swift` sits outside the comment-budget gate and violates the rules it enforces elsewhere
- **Severity**: nit
- **Axis**: build-release / docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `scripts/check-comments.ts:18-21` scans `sdk/ios/Sources` and `sdk/ios/Tests` only; `sdk/ios/Package.swift:4-10` is a 7-line block narrating history and rejected alternatives ("Tools-version 6.0 (up from 5.9) … `.unsafeFlags` was considered instead and rejected"), which is exactly what `AGENTS.md` forbids and the linter rejects one directory down.
- **What actually happens**: nothing at runtime; it is a blind spot in a gate the repo relies on, and `Package.swift` is one of the two files a merchant actually reads.
- **Fix sketch**: add the package roots (not just `Sources`/`Tests`) to `check-comments.ts`, and move the rationale to `docs/plans/native-sdk/05-build-and-release.md`.
- **Register status**: NEW.

## Verified-OK

- **Identity storage split** (3.3/S3 as closed): key + merchant marker in `Application Support/id.frak.sdk/identity.json` with `isExcludedFromBackup` set on the *directory* (`Core/FrakStorage.swift:24-26`) and `.completeUntilFirstUserAuthentication` re-applied after every atomic write (`Config/FileKeyValueStore.swift:117-137`); consent kept in the *backed-up* `id.frak.sdk.consent` suite (`Config/KeyValueStore.swift:25`) so a withdrawal survives a restore. Refusal-not-fallback on a missing directory (`Frak.swift:46,91-98`) is correct.
- **Pre-first-unlock semantics**: an unreadable store is never memoised as empty (`FileKeyValueStore.swift:86-95`), `loadOrCreate` refuses to mint over a locked-but-present identity (`Identity/DeviceKey.swift:63-70`), the queue's `fileReadNoPermission` path returns `durable: false` so `reconcile` cannot compact (`Tracking/EventQueue.swift:201-207,386-388`). This is the single best-reasoned part of the target.
- **Proof/codec wire formats**: fixed-width message + envelope, UUIDs as raw 16 bytes, big-endian ts with a non-negative guard, r+s never DER (`Identity/ProofCodec.swift:58-95`); `Base64URL.decode` rejects a stray alphabet char, a `%4==1` length and non-canonical trailing bits via a round-trip check (`Core/Base64URL.swift:19-33`).
- **`EventQueue` durability**: JSONL append with atomic full rewrites, torn-tail sweep, row-id migration that rolls back when the rewrite fails, `reconcile` as one read+write hop, amortised trim (`Tracking/EventQueue.swift:193-263,270-301,346-403`).
- **Drain coalescing** (9.4): `scheduleDrain` reuses the in-flight task and sets `drainAgain`; the token guard prevents two writers racing a `shutdown()` (`Tracking/EventOutbox.swift:181-205`) — no suspension point between the loop exit and the slot clear, so the tail is atomic.
- **Consent model**: tri-state with a compile-time hard floor, memoised, single shared `TrackingConsent` instance across client and identity store (`Core/TrackingConsent.swift:55-74`, `Frak.swift:50-70`); re-read per event inside the drain (`EventOutbox.swift:234,259-262`), and `break` (not `return`) on mid-drain withdrawal so already-uploaded rows are still reconciled.
- **`ConfigStore` ordering**: sequence minted before the network hop and compared at publish, so a slow fetch cannot overwrite a newer one on stream, memory or disk (`Config/ConfigStore.swift:157-197`); `isFresh` rejects a future `fetchedAt` (`:23-26`); dedup compares against `lastPublished`, not `memory`, for the right reason (`:63-70`).
- **`SingleFlight`**: identity-guarded eviction via an allocated `CompletionFlag`, per-waiter cancellation that does not kill the shared flight, `Waiter` handles settle-before-attach (`Config/SingleFlight.swift:31-62,109-134`).
- **`Backoff`**: exponential with cap, server `Retry-After` as a floor not a replacement, jitter, expired windows dropped on read (`Config/Backoff.swift:37-63`); `Retry-After` clamped 1…300 at parse (`Net/HTTPClient.swift:249-256`).
- **Rewards**: 30 s hard TTL (no SWR for money), products-free backoff key, cache swept on insert so a caller-controlled `products` key space stays bounded (`Rewards/RewardRepository.swift:56-65,130-136`); `ProductDetailsQueryEncoder` hand-formats numbers to match `JSON.stringify` (`-0`, `.0` stripping, non-finite dropped) and matches the backend's 8192 budget (`services/backend/src/api/user/merchant/index.ts:38`).
- **Decoders**: forgiving optionals/arrays with strict nested objects, per-entry placement tolerance (`Config/ResolvedConfigDecoder.swift:56-79`), and the required `merchantId`/`name`/`domain` match the backend schema exactly (`services/backend/src/domain/merchant/schemas/index.ts:237-244`); translations are already flattened server-side (`MerchantResolveService.ts:308-355`), so `[String: String]` is right.
- **Security hygiene**: ephemeral `URLSession` with no cache, redirects declined, query string and headers never logged, 422 body logged by length only (`Net/HTTPClient.swift:63-70,3-13,210-224`; `Config/ConfigStore.swift:217-221`); `.custom` origin allowlist parses via `URLComponents` so bracketed IPv6 works (`Core/FrakEnvironment.swift:76-95`).
- **Privacy manifest**: `NSPrivacyAccessedAPITypes` correctly limited to UserDefaults CA92.1 — the SDK reads no file timestamps and no disk-space APIs, so nothing else is required; UserID-not-DeviceID argument holds given the uninstall-scoped, Keychain-free key (`Sources/FrakSDK/PrivacyInfo.xcprivacy`, `Identity/DeviceKey.swift:33-36`).
- **Arrival duplication is safe backend-side**: `services/backend/src/api/schemas/interactionSchemas.ts:5-6` + `ArrivalHandler` key on `referralLinkId`, so the `EventOutbox.swift:255-258` worry about a duplicated referral payout does not materialise.
- **`Package.swift`**: `.swiftLanguageMode(.v6)` on all four targets, no dependencies, `.copy` (not `.process`) for both privacy manifests, `iOS 15`/`macOS 12` floors justified by the APIs actually used.

## Could not verify

- Whether `HTTPClient`'s `private let redirectDelegate = NoRedirectDelegate()` (a non-`Sendable` `NSObject` stored in a `Sendable` struct, `Net/HTTPClient.swift:5-14,75`) actually compiles clean under `.swiftLanguageMode(.v6)` — no Swift toolchain here; CI's `ios-sdk` job implies it does, but this is the one Sendable shape I would re-check by hand.
- Everything device-dependent: Secure Enclave key creation, `SKOverlay` presentation, the QuickType paste suggestion, `canOpenURL` behaviour with/without `LSApplicationQueriesSchemes` (register T3 says no device or simulator pass has ever run).
- Whether `PrivacyInfo.xcprivacy` actually propagates into a consumer app's bundle from a SwiftPM resource bundle (the manifest's own comment flags AppsFlyer #281 as the known failure mode).
- Whether App Store id `6759159306` (`AppLink/InstallLinks.swift:4`, `FrakSDKUI/StoreOverlay.swift:15`) is a live listing.
- Whether `isExcludedFromBackup` on the directory also excludes it from iOS *direct device-to-device* migration (it does for iCloud/encrypted backups; the transfer path is not something I can confirm from this repo).
