# Backend contract audit — Frak native SDKs (alpha)

Scope: the five endpoints the native SDKs call, their real handlers in `services/backend/src/`,
the identity proof-of-possession scheme, and the Kotlin/Swift clients that talk to them.
Worktree `/home/dev/wallet-audit` @ `c0a0cec`. Everything below is read-only verification; no
toolchain was available, so the one thing I could *execute* was an independent re-derivation of
the golden proof corpus in Python (see F-OK list).

## Summary

The wire contract is in better shape than I expected. I diffed all five routes field-by-field
against both clients and found **no param-name, casing, nullability or number-vs-string mismatch**
— the query params, body shapes and decoders line up, including the `formatted=1` string literal,
the `platform`+`packageId` pairing, and the base64url `products` payload. The proof scheme is the
strongest part: I re-derived every fixture in `golden-proofs.json` from first principles (P-256
scalar multiplication by hand) and backend, TS, Kotlin and Swift all agree byte-for-byte on the
message layout, the domain separators, the envelope, the id derivation and raw `r‖s` encoding.

The single worst thing is not a schema mismatch, it is a **flow ordering bug**: `POST
/user/identity/merge/execute` 404s `TARGET_NOT_FOUND` unless the target anonymous id already has a
node in the identity graph, and the native SDKs enqueue the merge *before* anything that would
create one — and never call `/identity/ensure`, which is what creates it on web. On a fresh
install (the exact case the `?fmt=` handoff exists for) the merge is rejected, retried 3×, then
silently dropped. Referral arrival still lands; the wallet↔app identity link does not.

Second: enforcement is latch-gated/permissive today and the ROLLOUT doc treats "does the install
proof stay sufficient" as an open decision. Shipping a frozen native binary **removes that
option** — that needs writing down before the alpha ships, not after. Third: `ROLLOUT.md` contains
a scary, prominent, and **false** blocker ("prod has no generated migration yet"); the migration
is in the tree.

Verdict: alpha-ready on the wire format, **not** alpha-ready on the merge path.

## Findings

### F1. `merge/execute` 404s on a fresh install — the `?fmt=` identity merge is silently lost

- **Severity**: high
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts:219-231` — after
    proof + token validation: `const targetGroup = await this.identityRepository.findGroupByIdentity({ type: "anonymous_fingerprint", value: targetAnonymousId, merchantId })` … `if (!targetGroup) { throw HttpError.notFound("TARGET_NOT_FOUND", …) }`. Nothing on this path
    creates the node — contrast `IdentityOrchestrator.resolve` (`:34-57`), which *does* create,
    and is only reached from `track/*` (`api/user/track/sdkIdentity.ts:…resolveForAttribution`)
    and `identity/ensure`.
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:268` — the merge is
    enqueued *first*: `if (mergeToken != null) mergeInboundIdentity(mergeToken)`, and only then
    (`:279`) `track(ReferralArrival.arrivalFrom(context))`. Same order on iOS.
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt:143-146,309` — the
    drain is strict FIFO ("stopping (not skipping) at the first failure"), `MAX_FAILURES = 3`.
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/RowSender.kt:29-42` — `classifyStatus`
    maps 404 to `DeliveryOutcome.Rejected` (only 429/5xx are retryable), and
    `EventOutbox.kt:134` drops the row on the 3rd rejection.
  - The native SDKs never call `/user/identity/ensure` — grep of both `Sources/`/`src/main/`
    trees yields exactly five backend paths (`ConfigStore.kt:241`, `RewardRepository.kt:270`,
    `InteractionSender.kt:49`, `PurchaseSender.kt:27`, `IdentityMerge.kt:27`), and `ensure` is not
    among them. On web the listener's `ensure` call is what creates the node first.
- **What actually happens**: user taps a merchant in the Frak wallet explorer
  (`apps/wallet/app/module/explorer/component/ExplorerDetail/index.tsx:116` appends `?fmt=`), an
  App Link opens the merchant app. If that app has not yet posted a `track/*` for this
  install+merchant, `merge/execute` returns 404 `TARGET_NOT_FOUND`. The row is retried on the next
  two flushes (blocking the arrival behind it each time — FIFO `break`), then dropped with only a
  `logger.warn`. The merge token is single-use-ish and short-lived, so the wallet↔app identity
  link is permanently lost for that user; rewards attributed to the app's anonymous group never
  join the wallet's group.
- **Fix sketch**: make `executeMerge` create the target node (reuse `identityOrchestrator.resolve`)
  instead of 404ing — a proven proof already establishes the id is self-authenticating; or, in the
  SDK, treat 404 on the merge kind as `Hold`/retryable and enqueue an arrival/no-op interaction
  ahead of the merge.
- **Register status**: NEW (`06-open-findings.md` has zero occurrences of `merge`, `proof`,
  `TARGET_NOT_FOUND` or any backend status code in its finding tables).

### F2. ROLLOUT-STEP-3 sequencing: shipping the native alpha permanently forecloses the "install proof must be exchanged for a ticket" option

- **Severity**: high
- **Axis**: security / build-release
- **Complexity to fix**: trivial (<1h) to *decide and document*; structural to undo later
- **Evidence**:
  - Enforcement today is **permissive/latch-gated**, not mandatory:
    `services/backend/src/orchestration/identity/latchedProof.ts:38-56` — `if (proof) { verifyOrThrow(); return true } … if (node?.proofSeenAt) throw 403 PROOF_REQUIRED … return false`
    (fail-open for any id that has never latched).
  - `services/backend/src/api/user/identity/ensure.ts:78-80` — "ROLLOUT-STEP-3: legacy bearer arm
    — a raw id with nothing proving it belongs to the caller"; `:101-104` — "once the bare
    `anonymousId` arm above is deleted, this proof becomes a SUFFICIENT credential and its leak
    surface (URL fragment, Play referrer) starts to matter — revisit whether it should still be
    accepted directly **or must be exchanged for an install ticket**".
  - `docs/plans/identity-proof-of-possession/ROLLOUT.md:72-76` — step 4 leaves that as an open
    decision.
  - The native binary emits exactly the shape that decision would break:
    `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/InstallLinks.kt:25,66` — `…&p=<proof>`
    and `…#p=<proof>`; nothing in the native SDK can obtain or carry an install *ticket*.
  - `docs/plans/native-sdk/01-platform-changes.md:137-139` claims "until then `?fmt=` merge is
    unsupported" — but the native SDK ships `MergeSender` and posts to `merge/execute` today.
- **What actually happens**: the native SDKs *always* sign (`MergeSender.kt:39-41` returns `Hold`
  rather than posting unsigned), so the merge flip to mandatory is safe for them. The danger runs
  the other way: an alpha store binary that only knows how to emit `#p=<install proof>` freezes
  the backend into accepting a bare install proof as a sufficient credential forever. The day
  someone "hardens" ensure by requiring a ticket, every already-shipped native install handoff
  stops linking identity, silently (ensure's proof path is fire-and-forget).
- **Fix sketch**: record in `ROLLOUT.md` that step 4's second half is decided by the native alpha —
  the install proof stays sufficient — or add ticket exchange to the native SDK *before* the first
  store submission.
- **Register status**: NEW.

### F3. `ROLLOUT.md` states a blocker that is false: the `proof_seen_at` migration exists for prod

- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `docs/plans/identity-proof-of-possession/ROLLOUT.md:63-66` — "against a database
  missing the column Postgres raises `42703` and the query throws — every proof-absent
  `/merge/execute` 500s instead of returning 200. **`prod` has no generated migration yet.**"
  Contradicted by `services/bootstrap/drizzle/prod/0020_gigantic_black_crow.sql:1`:
  `ALTER TABLE "identity_nodes" ADD COLUMN "proof_seen_at" timestamp;`, plus
  `services/bootstrap/drizzle/dev/0040_yummy_amphibian.sql:1` and
  `services/bootstrap/drizzle/local/0035_natural_carlie_cooper.sql:1`. Column declared at
  `services/backend/src/domain/identity/db/schema.ts:77`.
- **What actually happens**: someone reading the rollout doc as the gate treats this as a hard
  blocker and either delays, or (worse) re-generates a duplicate migration. It is stale.
- **Fix sketch**: delete the sentence; note the prod migration file name instead.
- **Register status**: NEW (this is in the identity plan, not `06-open-findings.md`).

### F4. `estimated-rewards` is charged to two rate-limit buckets — effective 60/min per IP, not the documented 90 — and the test that exists to catch this cannot

- **Severity**: medium
- **Axis**: correctness / tests
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `services/backend/src/api/user/merchant/index.ts:95` — `.use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 60 }))`, then `:96-97` `.get("/resolve", …)`, then `:146`
    `.use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 90 }))`, then `:147-148`
    `.get("/estimated-rewards", …)`. Elysia applies a `.as("scoped")` `onBeforeHandle`
    (`infrastructure/rateLimit/rateLimiter.ts:191-213`) to every route registered *after* it, so
    `/estimated-rewards` runs both limiters; `/resolve` runs only the 60 one. Each
    `rateLimitMiddleware()` call builds its own store (`rateLimiter.ts:188`) but both key on
    `ip:<addr>` (`:170-183`), so resolve and rewards traffic share the 60 bucket.
  - The pinning test registers all three limiters *before* the route
    (`services/backend/src/api/user/merchant/index.test.ts:306-334`), which is not the production
    layout, so it neither reproduces the interleaving nor detects the double-charge it implies.
  - `docs/plans/native-sdk/01-platform-changes.md:120-121` documents "60/min on `merchant/resolve`,
    90/min on `estimated-rewards`" — the second number is not what a client gets.
- **What actually happens**: on a shared egress IP (carrier-grade NAT, corporate wifi, a QA
  device farm) the combined resolve+rewards budget is 60/min per pod, not 60+90. Native clients
  cache (5 min config TTL, 30 s rewards) so this is unlikely to bite a single user, but the
  documented headroom does not exist and the 429 → `FrakError.BackingOff` path will be entered
  earlier than anyone planned.
- **Fix sketch**: move the 60 limiter to sit only around `/resolve` (its own sub-instance), or
  accept and correct the doc; rewrite the test to use the production registration order.
- **Register status**: NEW.

### F5. The interaction handler's comment claims the native SDK reads `isDuplicate`; it reads nothing

- **Severity**: medium
- **Axis**: docs-accuracy / parity
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `services/backend/src/api/user/track/interaction.ts:61-64` — "The native SDK keys its
    retry/idempotency handling off this flag, so it must stay in the schema".
  - No production native code decodes any `track/*` or `merge/execute` response body:
    `InteractionSender.kt:24-31` and `PurchaseSender.kt:15-22` call `classifyStatus(response)`,
    which only reads `response.status` (`RowSender.kt:29-42`). Grep for
    `isDuplicate|interactionLogId|identityGroupId|referralLinkId|pendingWebhook|finalGroupId`
    across `sdk/android` + `sdk/ios` hits **test files only**
    (`MergeSenderTest.kt:88`, `EventOutboxTest.kt:307`, `MergeSenderTests.swift:69`).
- **What actually happens**: two costs. (a) The comment is load-bearing-looking and wrong, so the
  next person to prune the response schema will trust it or be misled about who the consumer is.
  (b) More substantively, the SDK genuinely *cannot* tell a deduped replay from a fresh write, and
  `arrival` has no idempotency key at all (`interactionSchemas.ts:5-14`) — so a merchant who calls
  `Frak.track(Interaction.arrival(...))` for a link the SDK already handled double-counts, which
  is exactly what `Interaction.kt:31-35` warns about with no server-side backstop.
- **Fix sketch**: correct the comment to name the real reason the field stays (public API/Eden
  consumers); separately consider an `externalEventId`-style key for `arrival`.
- **Register status**: NEW.

### F6. The `frak-merge-v1` proof window is ±2 min against an unsynced device clock, and a rejection is unretryable

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `services/backend/src/domain/identity/services/IdentityProofService.ts:20-24,29` —
    `"frak-merge-v1": 2 * 60` and `MAX_FUTURE_SKEW_SECONDS = 60`; `isFresh` rejects anything
    outside that.
  - Client `ts` is raw device wall-clock seconds:
    `sdk/android/.../identity/AnonymousIdStore.kt:82` — `ts: Long = System.currentTimeMillis() / 1000`;
    Swift equivalent in `MergeSender.swift:39` → `ctx.signProof`.
  - Rejection is a 403 (`latchedProof.ts:41-48` → `verifyOrThrow` → `HttpError.forbidden("PROOF_INVALID")`),
    which `classifyStatus` (`RowSender.kt:29-42`) maps to `Rejected`, dropped after 3 attempts
    (`EventOutbox.kt:134`).
  - `packages/wallet-shared/src/identity/mergeTokenQueryOptions.ts:60-62` already records this as
    a known problem on the web side ("a proof signed at open time is routinely expired… this needs
    a wider window").
- **What actually happens**: a device whose clock is >60 s fast or >120 s slow (not rare on
  Android, and never surfaced to the user) fails every merge proof. All three retries fail for
  the same reason within seconds of each other, the row is dropped, the merge is lost with no
  merchant-visible signal — indistinguishable from F1.
- **Fix sketch**: widen `frak-merge-v1` to ~10 min (the token binding already prevents replay
  abuse), or treat 403 `PROOF_INVALID` as retryable-with-backoff on the merge kind only.
- **Register status**: NEW.

### F7. The SDK version header is logged and nothing else — no kill switch, and Android and iOS are indistinguishable

- **Severity**: medium
- **Axis**: build-release / merchant-setup
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - Both clients send it on every request:
    `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/HttpClient.kt:168`
    (`setRequestProperty(FrakSdkVersion.HEADER_NAME, FrakSdkVersion.CURRENT)`, value `"0.0.1"`,
    `FrakSdkVersion.kt:10,15`) and `sdk/ios/Sources/FrakSDK/Net/HTTPClient.swift:280`.
  - Backend reads it in exactly one place, as a log field:
    `services/backend/src/index.ts:64-65` — `sdkVersion: ctx.request.headers.get("x-frak-sdk-version") ?? undefined`
    inside `customProps`. Declared once more as an optional header schema
    (`infrastructure/macro/session.ts:68`). No routing, no gate, no metric label.
  - The web SDK never sends it (grep for `x-frak-sdk-version` across `sdk/core/src`,
    `packages/`, `apps/` returns nothing outside the backend), so *presence* does identify a
    native caller — but the value is `"0.0.1"` on both platforms, so Android vs iOS cannot be
    told apart, and neither can two different merchants' builds.
  - `docs/plans/native-sdk/01-platform-changes.md:154-158` already flags this ("accepted and
    logged but drive nothing … Needs an owner").
- **What actually happens**: a bad alpha build cannot be remotely disabled, and post-launch
  triage ("is the Moulinex iOS build the one generating these 422s?") has to go through log
  greps rather than metrics. For a first alpha with one merchant this is survivable; it should be
  an explicit accepted risk, not an oversight.
- **Fix sketch**: put the platform in the header value (`android/0.0.1`), add it as a metric
  label, and land a version-keyed global kill switch top-level on the resolve response.
- **Register status**: confirms `01-platform-changes.md` §5 ("The kill switch"); NEW as regards
  the platform being unidentifiable.

### F8. A rejected row blocks the whole outbox behind it for up to three flushes

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt:143-145`
  ("stopping (not skipping) at the first failure to keep FIFO order") and `:187-190` —
  `is DeliveryOutcome.Rejected -> { recordRetry(...); break }`. `MAX_FAILURES = 3` (`:309`), iOS
  identical (`EventOutbox.swift:15,301`).
- **What actually happens**: any permanently-4xx row — the F1 merge 404, a 422 from a malformed
  body, a 401 from a missing `x-frak-client-id` (see F9) — stalls every later event for three
  drain cycles. Because a drain is kicked off per `track()` call, a quiet app can take multiple
  sessions to clear the head, and a purchase queued behind an unqueuable merge is delayed by
  hours or days. FIFO is deliberate for ordering, but 4xx is a *verdict on that row*, not on
  ordering.
- **Fix sketch**: on `Rejected`, drop the row immediately (it can never succeed) rather than
  retrying and breaking, or skip past it and continue the drain.
- **Register status**: NEW.

### F9. A keystore failure produces rows with no `x-frak-client-id`, which the backend answers 401

- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:235-239` —
    `tracker.track(merchantId, identity.anonymousId(), interaction)`; `anonymousId()` is
    documented nullable (`AnonymousIdStore.kt:74-75`, "when the platform can't produce key
    material, `anonymousId` is null").
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/RowSender.kt:21-22` —
    `row.clientId?.let { mapOf("x-frak-client-id" to it) } ?: emptyMap()`: the header is simply
    omitted.
  - `services/backend/src/api/user/track/sdkIdentity.ts` (`resolveSdkIdentityNodes`) — with no
    client id and no wallet JWT, `identityNodes.length === 0` → 401
    `"x-frak-client-id or x-wallet-sdk-auth header required"`.
  - Contrast `buildSharingLink`, which *does* hard-fail on a null id
    (`DefaultFrakClient.kt:200-204`).
- **What actually happens**: on a device where key generation fails, every tracked event is
  enqueued, posted, 401'd, retried 3×, dropped — and blocks the queue behind it (F8) each time.
  Silent from the merchant's side (`track` returns `Success` because enqueue succeeded).
- **Fix sketch**: refuse to enqueue a row with a null `clientId` (or hold it) rather than posting
  a request that is guaranteed to 401.
- **Register status**: NEW.

### F10. Non-UUID `merchantId` in `FrakConfig` degrades to an opaque 422 with no actionable message

- **Severity**: low
- **Axis**: merchant-setup / UX-DX
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `services/backend/src/api/user/merchant/index.ts:135` —
  `merchantId: t.Optional(t.String({ format: "uuid" }))` on resolve, `:160`
  `merchantId: t.String({ format: "uuid" })` on estimated-rewards, and
  `interactionSchemas.ts:9,17,25` on all three interaction shapes. Neither client validates:
  `MerchantQuery.kt:45-57` and `MerchantQuery.swift:37-49` only trim and check non-empty. The SDK's
  response is `ConfigStore.kt:176-180` — "Frak sent a request the backend rejected as malformed
  (status 422, body N chars)", deliberately not logging the body.
- **What actually happens**: a merchant who pastes the wrong identifier (a name, a legacy product
  id, a UUID with stray whitespace inside) gets a 422 with the reason withheld, plus a
  merge/purchase queue that quietly drops everything. The 404 path has a good message
  (`ConfigStore.kt:165-169`); the 422 path does not.
- **Fix sketch**: validate the UUID shape client-side in `MerchantQuery.from` and throw
  `MerchantResolutionFailed` with the offending value.
- **Register status**: NEW.

### F11. `?fmt=` has no native-facing producer, and its only producers depend on undocumented App-Link/Universal-Link setup

- **Severity**: low
- **Axis**: merchant-setup / parity
- **Complexity to fix**: small (<1d) to document
- **Evidence**: the two producers of `fmt` are web page URLs —
  `apps/wallet/app/module/explorer/component/ExplorerDetail/index.tsx:111-118` (builds
  `https://{merchant.domain}?utm…&fmt=`) and
  `packages/wallet-shared/src/common/component/InAppBrowserToast/index.tsx:139-151`. Neither knows
  about a native app. The native consumer is `IdentityMerge.parseToken`
  (`sdk/android/.../identity/IdentityMerge.kt:29`, `sdk/ios/.../Identity/IdentityMerge.swift:18`),
  which only ever sees the URL if the merchant's app claims that HTTPS domain via Android App
  Links / iOS Universal Links. Nothing in the native SDK's setup path checks or documents that.
  Native also cannot *mint* a token: `merge/initiate` is called by no native code (only
  `packages/wallet-shared/src/identity/mergeTokenQueryOptions.ts:58` and
  `sdk/core/src/actions/migrateLegacyIdentity.ts:53`).
- **What actually happens**: a merchant integrates the SDK, does not configure `assetlinks.json` /
  AASA for their domain, and the entire inbound-merge feature is dead with no error anywhere.
  Combined with F1 it means the merge path has probably never worked end to end (consistent with
  `AGENTS.md`: "the install handoff and inbound deep links have run nowhere").
- **Fix sketch**: document App Links/Universal Links as a hard prerequisite in the SDK README, and
  log once at init when the SDK sees no deep-link registration for the resolved merchant domain.
- **Register status**: partially overstated in `01-platform-changes.md:137-139`, which says
  "`?fmt=` merge is unsupported [until ROLLOUT-STEP-3]" — the backend arm is live and latch-gated
  today, so "unsupported" is wrong; "unreachable without merchant deep-link setup" is right.

### F12. `sharingTimestamp` is a raw `Long`/`Int64` in the public API and lands in a Postgres `::int` cast

- **Severity**: nit
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: the SDKs default it to seconds
  (`sdk/android/.../tracking/EventOutbox.kt:290` — `kind.sharingTimestamp ?: (now() / 1000)`;
  `sdk/ios/.../Tracking/EventOutbox.swift:373` — `Int64(now().timeIntervalSince1970)`), but the
  public overloads take an unlabelled `Long`/`Int64` (`Interaction.kt:66-69`,
  `Interaction.swift:35`) with no unit stated in the doc. The backend schema is only
  `t.Optional(t.Number())` (`interactionSchemas.ts:19`), and the value is later cast in SQL:
  `services/backend/src/domain/rewards/db/schema.ts:54` — `((payload->>'sharingTimestamp')::int)`
  (and `InteractionLogRepository.ts:93`).
- **What actually happens**: a merchant passing `System.currentTimeMillis()` writes a value that
  overflows `int4`; the insert succeeds (it is JSONB) and the failure surfaces later, inside the
  reward-history join, for that merchant only. Also note the web SDK never sends this field at
  all — native is the only producer.
- **Fix sketch**: name the parameter `sharingTimestampSeconds` (or validate the magnitude at
  enqueue) and add a `bigint` cast or a range guard server-side.
- **Register status**: NEW.

## Verified-OK

**The proof (traced byte by byte, all four implementations):**
- Message layout `op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8 BE)` is identical in
  TS (`sdk/core/src/identity/canonical.ts:buildProofMessage`), backend (same function, imported at
  `IdentityProofService.ts:6-11`), Kotlin (`ProofCodec.kt:65-91`) and Swift
  (`ProofCodec.swift:58-74`). Envelope `v(1) ‖ pk(65) ‖ ts(8) ‖ sig(64)`, base64url unpadded, all
  four agree (`canonical.ts:encodeProof`, `ProofCodec.kt:93-107`, `ProofCodec.swift:76-88`).
- Domain separators match exactly: backend `PROOF_WINDOW_SECONDS` keys
  (`IdentityProofService.ts:20-27`) vs `ProofOp.kt:15-16` / `ProofOp.swift:6-9`
  (`frak-install-v1`, `frak-merge-v1`); native deliberately omits `frak-ensure-v1`/`frak-sso-v1`
  and `ProofCodecTest.kt:60` asserts every op it *can* mint has a fixture.
- UUIDs are signed as 16 raw bytes on every platform, so the Swift-uppercase / Kotlin-lowercase
  hazard is genuinely closed (`canonical.ts:uuidToBytes`, `ProofCodec.kt:42-45`,
  `ProofCodec.swift:30-35` via `withUnsafeBytes(of: uuid.uuid)`).
- Id derivation `uuid_v4_bits(SHA-256(pk_uncompressed)[0..16])` matches on all four
  (`canonical.ts:deriveClientIdFromHash`, `IdentityProofService.ts:deriveIdFromKey`,
  `ProofCodec.kt:54-62`, `ProofCodec.swift:47-55`), and the backend compares
  `derivedId !== params.anonymousId.toLowerCase()` (`IdentityProofService.ts`), which is
  case-safe against `AnonymousIdStore`'s lowercase output.
- Signature encoding: raw `r‖s`, never DER. Android converts JCA's DER back to raw
  (`DeviceKey.kt:57-75`, with the leading-zero strip and 32-byte right-align), CryptoKit uses
  `rawRepresentation` (`DeviceKey.swift:21-26`), backend verifies with
  `crypto.subtle.verify({name:"ECDSA", hash:"SHA-256"}, …)` over P-256
  (`IdentityProofService.ts:importPublicKey` + `isSignatureValid`), which accepts high-S — matching
  the "low-S NOT guaranteed" note in `canonical.ts`.
- **Independently re-derived the whole corpus.** I re-implemented P-256 scalar multiplication and
  ECDSA verification in Python and ran it over all 6 fixtures in
  `sdk/core/src/identity/fixtures/golden-proofs.json`: for every entry the `derivedClientId`,
  `canonicalMsgHex` and `proof` reproduce exactly from `pubkeyUncompressedHex`/`op`/`merchantId`/
  `anonymousId`/`bindingHex`/`ts`, each `pubkeyUncompressedHex` is `privkeyHex · G`, and each
  `sigHex` verifies as ECDSA-SHA256 over `canonicalMsgHex` (all 6 low-S, all 64-byte sigs, all
  65-byte keys). The corpus is real, self-consistent and cryptographically valid — and both native
  test suites assert against it (`ProofCodecTest.kt:27-99`, `ProofCodecTests.swift`).
- Merge binding: `SHA-256(utf8(mergeToken))` on all three
  (`IdentityProofService.ts:hashMergeToken` via `@oslojs` `sha256`, `IdentityMerge.kt:32-33`,
  `IdentityMerge.swift:24-26`). Replay is bounded by the token binding + 60-min JWT rather than a
  server-side nonce cache — a deliberate, documented trade.
- Merge hold timeout (`MergeSender.kt:16`, `MergeSender.swift:12`) cites
  `AnonymousMergeService.ts:36`, and that line does contain the 60-minute expiry. Accurate.

**Route-by-route contract diff (no mismatches found):**
- `GET /user/merchant/resolve` (`api/user/merchant/index.ts:96-144`, prefix chain
  `user/index.ts:8` → `merchant/index.ts:94`): query `domain?/merchantId?(uuid)/lang?/packageId?/platform?(android|ios)`.
  Both clients send `{merchantId,lang}` or `{packageId,platform,lang}` and never `packageId`
  without `platform` (`MerchantQuery.kt:27-32`, `MerchantQuery.swift:19`), so the
  `INVALID_PACKAGE_ID_PAIRING` 400 is genuinely unreachable. `platform` literals
  `"android"`/`"ios"` match `PlatformSchema` (`domain/merchant/schemas/index.ts:42`). Response
  fields decoded by `ResolvedConfigDecoder.kt:17-106` are a strict subset of
  `MerchantResolveResponseSchema`+`ResolvedSdkConfigSchema` (`schemas/index.ts:216-247`) with the
  same casing; `productId`/`allowedDomains`/`css` are ignored, which is safe. `hidden` is only
  emitted when true (`MerchantResolveService.ts:353`) and the decoder defaults it false
  (`ResolvedConfigDecoder.kt:39`). 404 is `text/plain` and the SDK dispatches on status, not
  Content-Type (`ConfigStore.kt:162-170`).
- `GET /user/merchant/estimated-rewards` (`index.ts:147-224`): `formatted` is
  `t.Literal("1")` and both clients send the literal string `"1"`
  (`RewardRepository.kt:100-104`, `RewardRepository.swift:9`) — the one place a boolean would have
  silently dropped `best`. `currency`/`audience` wire values match the backend unions. `products`
  is `base64url(utf8(JSON.stringify(...)))` on both sides — Kotlin's hand-built, alphabetically
  ordered JSON (`RewardRepository.kt:173-205`) and `Base64Url.encode`'s unpadded output decode
  cleanly through `decompressJsonFromB64` → `base64urlDecode` (which re-pads,
  `sdk/core/src/utils/compression/b64.ts:18-28`) → `JSON.parse`. The 8192 cap matches on all three
  (`index.ts:PRODUCTS_PARAM_MAX_LENGTH`, `RewardRepository.kt:275`,
  `ProductDetailsQueryEncoder.swift:11`). `TokenAmount`'s four required numbers
  (`utils/typebox/typeSystem.ts:45-50`) match `RewardsDecoder.kt:93-99`. `best.isProductScoped` /
  `matchedProducts` are declared in `BestRewardSchema` (`campaign/schemas/index.ts:309-326`) so
  Elysia does not strip them, and the decoder tolerates their absence
  (`RewardsDecoder.kt:108-117`). This endpoint never 404s and the SDK says so explicitly
  (`RewardRepository.kt:118-127`).
- `POST /user/track/interaction` (`api/user/track/interaction.ts`): the three body shapes
  (`api/schemas/interactionSchemas.ts:7-36`) match what `EventOutbox.interactionPayload` emits
  (`EventOutbox.kt:272-305`, `EventOutbox.swift:358-385`) field for field, including omitting
  nulls rather than sending JSON `null` (Kotlin `JSONObject.put(k, null)` removes; Swift
  `compactMapValues`). `idempotencyKey` is written only for `sharing`/`custom`, matching which
  schemas declare it. `referrerClientId` must be a UUID and the FrakContext v2 codec encodes it as
  16 raw bytes (`FrakContextCodec.kt:50,76`), so it always is. `referrerWallet` is emitted
  `0x`-prefixed (`FrakContextCodec.kt:123,136`) and passes the server's `isAddress`
  (`interactionSchemas.ts:56-79`).
- `POST /user/track/purchase` (`api/user/track/purchase.ts:10-15`): body
  `{customerId, orderId, token, merchantId}` matches `EventOutbox.trackPurchase`
  (`EventOutbox.kt:72-87`) + `merchantId` injected at send (`PurchaseSender.kt:13`). The backend
  accepts string-or-number for customerId/orderId; the SDK always sends strings, which is the
  safer arm.
- `POST /user/identity/merge/execute` (`api/user/identity/merge.ts:63-103`, prefix
  `identity/index.ts:7` + `merge.ts:6`): body `{mergeToken, targetAnonymousId, merchantId, proof?}`
  matches `IdentityMerge.body` on both platforms (`IdentityMerge.kt:35-45`,
  `IdentityMerge.swift:30-38`) exactly.

**Idempotency, verified in the handler:**
- Purchase dedupes on `(orderId, normalizedToken)` —
  `orchestration/PurchaseLinkingOrchestrator.ts:104-131` (`findByOrderAndToken`, then
  `purchaseClaimRepository.upsert` with `rebindExisting: merge`, and `merge:false` on this route
  per `purchase.ts:65-67`). The SDK's own idempotency key is deliberately not sent
  (`EventOutbox.kt:72`) and that comment is correct.
- Sharing/custom dedupe on the client-supplied `idempotencyKey` via
  `SharingHandler.buildExternalEventId` (`orchestration/interaction-submission/handlers/SharingHandler.ts:29-36`),
  and the key is stamped once at enqueue, not per attempt (`EventOutbox.kt:67`), so retries dedupe.
- The merge is idempotent by construction (a second `associate` of already-merged groups returns
  `merged:false`).

**Other:**
- `resolveForAttribution` never merges groups from an unauthenticated `track/*` call
  (`IdentityOrchestrator.ts:176-186` + `sdkIdentity.ts` comment) — a forged `x-frak-client-id`
  can only mis-attribute into the forger's own group. Correct, and the native SDK's headers can't
  do better than that anyway.
- Error mapping is sound: `FrakError.Server(status, code, retryAfterSeconds)`
  (`core/FrakError.kt:63-78`) tolerates both the JSON `{success,error,code}` envelope
  (`utils/httpError.ts:toResponse`) and the code-less `t.Omit(t.ErrorResponse, ["code"])` bodies
  the track routes return (`interaction.ts:75-76`), and the plain-text `"Too Many Requests"` from
  the rate limiter (`rateLimiter.ts:210`) — `errorCodeOrNull` returns null rather than throwing
  (`JsonReader.kt:22`). `Retry-After` is parsed and clamped (`HttpClient.kt:222-227`) and feeds
  `Backoff` as a floor (`Backoff.kt:43-53`), matching the header the limiter sets
  (`rateLimiter.ts:203-209`).
- Request/response size: 1 MiB response cap on both clients (`HttpClient.kt:181-220`,
  `HTTPClient.swift:45`), server-side product param capped at 8192 chars / 50 entries
  (`api/user/merchant/index.ts` `decodeProductsQueryParam`). No body-size limit is configured on
  the backend, but every native POST body is small and bounded by construction.
- Base URLs match infra: `https://backend.frak.id` / `https://backend.gcp-dev.frak.id`
  (`FrakEnvironment.kt:17-25`, `FrakEnvironment.swift:36-39`) vs
  `infra/gcp/utils.ts:5-7` (`backend.gcp-dev.frak.id` is the primary ingress host) and
  `infra/gcp/backend.ts:53,148-151`.
- No endpoint the SDK calls is missing, and none of the five is listener-only. `merge/initiate`
  and `identity/ensure` are the two the native SDK deliberately does not implement; see F1/F2/F11
  for the consequences.

## Could not verify

- Elysia's precise hook-propagation semantics for `.as("scoped")` across an interleaved
  `use → get → use → get` chain (F4). The behaviour I describe follows from Elysia's
  register-order model and is consistent with `index.test.ts:306-334`, but I could not run the
  server to observe it. If Elysia in fact applies scoped hooks to *all* routes of the parent
  regardless of order, then `/resolve` is *also* charged to the 90 bucket and both routes share a
  60-effective cap — the conclusion (documented 90/min is wrong) holds either way.
- Whether any legacy (pre-derivation) web `clientId` is a non-UUID. If some are, they would 422
  the `arrival` schema's `referrerClientId` for web callers too, so I infer they are UUIDs — but
  I could not read the historical generator, only the current derived one
  (`sdk/core/src/identity/sign.ts:140-198`).
- Real-world 429 pressure on `merchant/resolve` behind carrier-grade NAT — depends on deployment
  replica count and traffic shape, neither observable here.
- Whether the alpha merchant's app will actually be able to receive `?fmt=` (F11) — depends on
  `com.groupeseb.moulinex.food`'s App Links configuration, which is outside this repo.
- I could not execute the Kotlin/Swift test suites (no JDK, no Swift toolchain); the proof
  agreement is established from source reading plus my independent re-derivation of the corpus,
  not from a green test run.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "12 findings (F1-F12) with severity, axis, complexity and path:line evidence, ranked worst-first, written to /tmp/frak-audit/backend-contract.md; plus a Verified-OK coverage list and an explicit could-not-verify list."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "python3 - (re-derive golden-proofs.json: uuid derivation, canonical message, envelope, base64url)",
      "result": "passed",
      "summary": "All 6 fixtures: derivedClientId, canonicalMsgHex and proof reproduce exactly."
    },
    {
      "command": "python3 - (hand-rolled P-256 ECDSA verify + pubkey re-derivation over all 6 fixtures)",
      "result": "passed",
      "summary": "All 6 signatures verify against SHA-256(canonicalMsg); all pubkeys equal privkey*G; all low-S, 64-byte sigs, 65-byte keys."
    },
    {
      "command": "grep/find/sed across services/backend/src, sdk/android, sdk/ios, sdk/core, apps/wallet, packages, infra, services/bootstrap/drizzle",
      "result": "passed",
      "summary": "Route handlers, schemas, clients, migrations and rollout docs read directly; no repo file modified."
    }
  ],
  "validationOutput": [
    "golden-proofs.json formatVersion=1, 6 fixtures; each: derivedClientId OK, canonicalMsgHex OK, proof OK, sig 64 bytes, pk 65 bytes",
    "ECDSA verify True and privmatch True and lowS True for all 6 fixtures",
    "services/bootstrap/drizzle/prod/0020_gigantic_black_crow.sql:1: ALTER TABLE \"identity_nodes\" ADD COLUMN \"proof_seen_at\" timestamp; (contradicts ROLLOUT.md:66)",
    "grep isDuplicate|interactionLogId|identityGroupId|referralLinkId|pendingWebhook|finalGroupId over sdk/android+sdk/ios: test files only"
  ],
  "residualRisks": [
    "F1 (merge/execute 404 TARGET_NOT_FOUND on a fresh install) is inferred from code paths; it has never been exercised on a device (AGENTS.md: the install handoff and inbound deep links have run nowhere), so its blast radius is reasoned rather than observed.",
    "F4's exact effective rate limit depends on Elysia scoped-hook ordering that I could not execute; the documented 90/min is wrong under either interpretation.",
    "No toolchain: no Kotlin/Swift/backend test was run. Proof agreement rests on source reading plus an independent Python re-derivation of the pinned corpus, which cannot catch a divergence introduced by the platform crypto APIs at runtime (e.g. an AndroidKeyStore provider emitting an unexpected DER form).",
    "I did not audit the sharing WebView, install code/ticket routes, or /user/merchant/referral-status in depth; they were out of the five-endpoint scope but touch the same identity graph.",
    "Whether legacy web clientIds are all UUIDs is inferred, not proven; if any are not, native arrival tracking for those referrers 422s."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repo files changed (read-only audit). One artifact written outside the repo: /tmp/frak-audit/backend-contract.md",
  "reviewFindings": [
    "high: services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts:219-231 - merge/execute 404s TARGET_NOT_FOUND when the target anonymous node does not exist; native SDKs enqueue the merge before any node-creating call and never call /identity/ensure, so a fresh install loses the identity merge permanently (dropped after 3 retries, RowSender.kt:29-42 + EventOutbox.kt:134)",
    "high: services/backend/src/api/user/identity/ensure.ts:101-104 + docs/plans/identity-proof-of-possession/ROLLOUT.md:72-76 - shipping a frozen native binary that can only emit a bare #p= install proof forecloses ROLLOUT-STEP-3's open decision to require a ticket; must be decided before store submission",
    "medium: docs/plans/identity-proof-of-possession/ROLLOUT.md:63-66 - claims prod has no proof_seen_at migration; services/bootstrap/drizzle/prod/0020_gigantic_black_crow.sql:1 proves otherwise (stale blocker)",
    "medium: services/backend/src/api/user/merchant/index.ts:95,146 - estimated-rewards is charged to both rate-limit buckets (effective 60/min per IP, not the 90 documented in 01-platform-changes.md:120); the pinning test at index.test.ts:306-334 uses a non-production registration order and cannot catch it",
    "medium: services/backend/src/api/user/track/interaction.ts:61-64 - comment claims the native SDK keys idempotency off isDuplicate; no native production code decodes any track response body (classifyStatus reads only the status)",
    "medium: services/backend/src/domain/identity/services/IdentityProofService.ts:20-29 - frak-merge-v1's 2-minute window is checked against raw device wall-clock (AnonymousIdStore.kt:82); a skewed clock 403s every merge and 403 is classified unretryable",
    "medium: services/backend/src/index.ts:64-65 - x-frak-sdk-version is only a log field: no kill switch, and the value 0.0.1 is identical on Android and iOS so the two cannot be told apart",
    "medium: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt:187-190 - a permanently-rejected row breaks the FIFO drain, stalling every later event for three flush cycles",
    "low: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:235-239 - a null anonymousId still enqueues rows, which post without x-frak-client-id and are 401'd then dropped",
    "low: services/backend/src/api/user/merchant/index.ts:135,160 - non-UUID merchantId yields an opaque 422 the SDK deliberately cannot explain (ConfigStore.kt:176-180); no client-side shape validation",
    "low: apps/wallet/app/module/explorer/component/ExplorerDetail/index.tsx:111-118 - the only ?fmt= producers are web URLs; native delivery needs App Links/Universal Links that no SDK doc lists as a prerequisite, and 01-platform-changes.md:137-139's claim that ?fmt= merge is 'unsupported' is wrong (the backend arm is live)",
    "nit: services/backend/src/domain/rewards/db/schema.ts:54 - sharingTimestamp lands in a Postgres ::int cast while the public API takes an unlabelled Long/Int64; a merchant passing millis overflows int4 and fails later, in the reward-history join"
  ],
  "manualNotes": "The proof scheme is the strongest part of this area and I would not spend more time on it: I re-derived the entire pinned corpus independently (P-256 by hand in Python) and backend/TS/Kotlin/Swift agree byte-for-byte on message construction, domain separators, hash, raw r||s encoding, curve, id derivation and the envelope. The register at docs/plans/native-sdk/06-open-findings.md contains literally nothing about the backend contract (no occurrence of 'merge', 'proof', a status code or an endpoint name in its finding tables), so all 12 findings are NEW to it. The two docs I did contradict are docs/plans/identity-proof-of-possession/ROLLOUT.md:66 (stale migration blocker) and docs/plans/native-sdk/01-platform-changes.md:120 and :137-139 (rate limit number, and '?fmt= merge is unsupported'). If only one thing is fixed before alpha, fix F1 — every other finding degrades gracefully, F1 loses referral money silently."
}
```
