# Round-3 review — `7a673da17` (backend merge) and `94744d8b4` (second-round fixes)

**Scope:** `services/backend/src/orchestration/identity/**`, `apps/wallet/nginx*`, `sdk/android/frak-sdk-ui/.../SharingHost.kt`, `sdk/android/.../net/ServerClock.kt`, `sdk/{android,ios}` URL-query + reset paths, `docs/plans/native-sdk/12-alpha-audit-response.md`.
**Method:** source read on `review/alpha-fixes` (`388b8c5b3`) via `git show`/`git diff`. No JDK, no Swift, no nginx, no device — nothing below was executed. Where a claim depends on runtime semantics I say so.

---

## Verdict

`7a673da17` fixes the fresh-install 404 (§3.3) and gets the `markProofSeen` ordering right, but it **does not implement the guard the audit made a precondition of that fix**. The target node is now get-or-created *unconditionally* — `resolve` sits outside any proof branch (`AnonymousMergeOrchestrator.ts:211-221`), the fail-open arm of `enforceLatchedProof` still allows a proofless request for any unlatched id (`latchedProof.ts:60-73`), and `/merge/execute` has no auth (`api/user/identity/merge.ts:63-103`). That is exactly the "name any `anonymousId`, have it conjured, fold it into your group with no proof" shape §3.3 named, it ships with no test, and the commit message justifies the omission by pointing at §2.2's withdrawal — which is a different finding on a different trust boundary. **This is the most important item in my area (N1).**

One correction that cuts the other way, and it is against the audit as much as the branch: the 404 was never *the* guard. `initiateMerge`'s documented auto-create arm (`AnonymousMergeOrchestrator.ts:69-73, 122-150`) has always folded an arbitrary, non-existent `sourceAnonymousId` into an authenticated caller's wallet group with no proof. The branch opens a second door to a room that already had one. The finding stands; the audit's blast-radius framing was incomplete.

`94744d8b4` is the better commit. The nginx fix is complete and correct across all seven `add_header` sites plus the Dockerfile; the `TRIM_MEMORY` predicate is now right in both directions with four tests; `getExact`/`exactValue` landed symmetrically with tests; iOS `resetAnonymousId` now awaits. Of the round-2 items I filed, one landed whole (nginx), two landed half (warm WebView, ServerClock), one was skipped and disclosed (iOS byte cap), one was skipped and **not** disclosed (iOS custom-data bounds), and one was skipped silently and entirely (`SharingLinkBuilder.build`'s null). One bullet of the commit message is simply false: `InstallLinks.swift` is untouched by every commit on this branch.

---

## Fixes that land

- **§3.3 core defect** — `merge/execute` no longer 404s on a fresh install; the target is get-or-created through `IdentityOrchestrator.resolve` — `AnonymousMergeOrchestrator.ts:216-221`.
- **§3.3 `markProofSeen` ordering** — moved after the node exists, gated on `proofPresented`; the claim that it was previously a silent no-op is true (`markProofSeen` is an UPDATE, `IdentityRepository.ts:132-151`) — `AnonymousMergeOrchestrator.ts:223-231`, order pinned by a test at `AnonymousMergeOrchestrator.test.ts:363-402`.
- **§3.3 race-safety claim** — accurate: `resolve` re-checks, inserts inside a transaction, and rolls its empty group back on `onConflictDoNothing` losing the unique constraint — `IdentityOrchestrator.ts:31-65` + `IdentityRepository.ts:419-455`.
- **§10.3 nginx F5 (my P1)** — all six headers are now one file included at every site that declares an `add_header`: `nginx.conf:47, 56, 66, 104, 140, 152, 167`; definition at `nginx-security-headers.conf:8-19`; shipped by `Dockerfile:109`. Fail-closed: a missing COPY stops nginx.
- **§10.3 warm-WebView guard level (my P2, first half)** — `isMemoryPressure` is correct against the real constants (RUNNING_LOW 10 ✓, RUNNING_CRITICAL 15 ✓, UI_HIDDEN 20 ✗, BACKGROUND/MODERATE/COMPLETE ✓, RUNNING_MODERATE 5 ✗) — `SharingHost.kt:526-528`, four tests in `SharingHostMemoryPressureTest.kt:9-30`.
- **parity F12 `?fmt=` exact-key** — `getExact` / `exactValue` on both platforms with symmetric tests, `fCtx` keeps the case-insensitive fallback — `UrlQuery.kt:32-37`, `URLQuery.swift:56-61`, `UrlQueryTest.kt:88-97`, `URLQueryTests.swift:31-42`.
- **android-core F11 iOS half** — `await tracker.purge()` replaces the detached `Task` — `DefaultFrakClient.swift:150-157`.
- **ServerClock KDoc** — the stale "2-minute window" is now 10 minutes and names the right asymmetry — `ServerClock.kt:8-11`.
- **The response doc's honesty gap** — §2.1 now enumerates the unfixed rows and marks the Android-only ones — `12-alpha-audit-response.md:107-123`.

---

## Fixes that DO NOT fully land

### P1. §3.3 — the proof gate the audit made a precondition is absent
- **Claimed in** `7a673da17`: *"The proof itself is still verified first, before anything is created or merged"* and *"the audit's sequencing warning … no longer applies: §2.2 is withdrawn."*
- **Reality**: verified-*if-presented*, never required. `enforceProof` returns a boolean and its no-proof arm returns `true`-to-continue for any unlatched id (`latchedProof.ts:60-73`); `resolve` then runs unconditionally (`AnonymousMergeOrchestrator.ts:216-221`). Of the audit's three prescriptions — (a) auto-create only inside the proof-verified branch, (b) keep `TARGET_NOT_FOUND` otherwise, (c) move `markProofSeen` after the node exists — only (c) landed. (a) and (b) are absent, and the `proof` docstring that made them necessary is still there verbatim: *"unlatched ids, including legacy ones, keep working as merge targets"* (`:184-192`).
- **Residual severity**: **high (security)** — detail and the pre-existing twin in **N1**.
- **What to do**: N1's fix sketch. It costs native nothing: `MergeSender.kt:39-43` mints a proof on every attempt, so the only intended consumer is always on the proven branch.

### P2. §3.7 / android-core F8 — two of five ServerClock items, and the bound is nominal
- **Claimed in** `94744d8b4`: *"it had no upper plausibility bound … Bounded at 2100-01-01, with the vectors added."*
- **Reality**, item by item:
  1. **Upper bound — nominal.** `LATEST_PLAUSIBLE_MILLIS = 2100-01-01` (`ServerClock.kt:49-50`). The failure the finding names — a TLS-terminating proxy or stale edge answering `Date: … 2027`, adopted verbatim and skewing every proof past the server's +60 s bound — is **still accepted**. Only an absurd date is rejected. The missing half is still a bound *relative* to the device clock (or two agreeing observations).
  2. **Not persisted** — unchanged. `offsetMillis` is per-`Frak.initialize` (`ServerClock.kt:16-18`, constructed at `Frak.kt:90`).
  3. **KDoc** — fixed (`:8-11`).
  4. **Tested only in isolation** — unchanged. `ServerClockTest.kt` gained two rejection vectors; nothing asserts `HttpClient.perform` calls `observe` (`HttpClient.kt:183`), that `AnonymousIdStore` signs with the shared instance, or that `Frak.initialize` shares one. Both `AnonymousIdStore.kt:46` and `DefaultFrakClient.kt:63` still default to a private `ServerClock()`, so a forgotten wiring silently reverts to the device clock.
  5. **`MAX_FUTURE_SKEW_SECONDS = 60`** — untouched (`IdentityProofService.ts:34`, used at `:65`). A device 61 s **fast** still fails every proof, on both platforms; the 10-minute merge window (`:24`) buys slack on the past side only.
  - **Platform**: iOS still has no `ServerClock` (`git grep ServerClock sdk/ios` → 0 hits; `AnonymousIdStore.swift:71` stamps `Date()`). Disclosed in `12-alpha-audit-response.md:120` and in the commit message — honest, still open.
- **Residual severity**: high (unchanged from round 2 — the reward-bearing proof path on iOS, plus a bound that does not bind).
- **What to do**: reject an offset beyond ~24 h of the device clock; persist it beside the identity store; add one integration test that stubs a `Date` header and asserts the resulting proof `ts`; raise or justify `MAX_FUTURE_SKEW_SECONDS`.

### P3. §10.3 warm WebView — the guard is fixed, the re-warm is not
- **Claimed in** `94744d8b4`: *"Nothing broke — `present()` re-warms."*
- **Reality**: half true and the half that is true is the half I already conceded. `present()` does call `warm()` (`SharingHost.kt:301`), so nothing is permanently broken — but it calls it *at the tap*, so the view is cold against the 5 s deadline. Nothing re-warms on **foreground**: `SharingHost` is a `DefaultLifecycleObserver` that overrides `onDestroy` only (`SharingHost.kt:445`; no `onStart`/`onResume`), and `SharingWebViewPool.trim()` still nulls `pooled` **and** `warmUrl` (`SharingWebViewPool.kt:146-153`). So the common case (plain home press) is genuinely fixed, and the still-common case — backgrounded *and* the system asks for `TRIM_MEMORY_BACKGROUND`/`MODERATE`, which is routine on real devices — still empties the pool with no recovery until the next tap.
- **Residual severity**: low-medium (latency only, on the sheet path that has no device evidence).
- **What to do**: override `onStart`/`onResume` to call `warm()` when `warmState is Resolved` and the pool is empty; three lines, and it makes the "released on real pressure" KDoc true instead of aspirational.

### P4. §10.3 — `SharingLinkBuilder.build`'s bare null: skipped entirely, and not listed as skipped
- **Claimed in**: nothing. It appears in neither commit message nor `12-alpha-audit-response.md` §2.1's "honest list".
- **Reality**: `git diff --stat 6cd61d665 review/alpha-fixes` touches no `SharingLinkBuilder`, `SharingApi` or `SharingSessionBuilder` file. `SharingLinkBuilder.kt:24-25` still `return null` for a non-http(s) base; `SharingApi.kt:15-18` still publishes *"@return null **only** when there is nothing to link to"*; `SharingSessionBuilder.kt:64` still reports the wrong cause (`MerchantResolutionFailed("no anonymous id or merchant to build a sharing link from")`) to a merchant whose only sin was `request.link = "myapp://product/1"`. Still no test on either platform.
- **Residual severity**: medium (public-contract violation with a misleading error, behaviour changed for an existing caller between `f1dc693` and this branch).
- **What to do**: throw `FrakError.InvalidArgument`-shaped, or document the second null arm on `buildLink`/`buildLinkAsync` and map it to its own cause in the sheet. Add the two tests.

### P5. android-core F5 — the iOS custom-data bounds were skipped *and* dropped from the disclosure
- **Claimed in** `12-alpha-audit-response.md:121`: only *"Queue byte cap (`MAX_BYTES`) — Android only: iOS has the row cap but no byte budget."*
- **Reality**: my P3 was two things — the byte cap **and** the 32-entry/512-char custom-data bounds. iOS still writes `"data": data` verbatim with no cap on entries, key length, value length or `customType` (`sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift:391-395`). The response table names the byte cap and silently drops the data bounds, so the "honest list" is itself one row short. (`MAX_BYTES` confirmed absent on iOS: `git grep -i "maxbytes|byteBudget" sdk/ios` → 0 hits.)
- **Residual severity**: medium — same merchant code, different rows on the two platforms; P4 of round 2 (silent truncation, `customType` capped at 512 against the backend's 100 at `interactionSchemas.ts:31`) is untouched on both.
- **What to do**: port both caps, or add the data-bounds row to §2.1 next to the byte cap.

### P6. The commit message's `InstallLinks.swift` bullet is false
- **Claimed in** `94744d8b4`: *"`InstallLinks.swift` documents why the App Store id is environment-independent rather than pretending a development listing exists."* — listed under *"Also fixed while there, all executed"*.
- **Reality**: `git diff --stat f1dc693 review/alpha-fixes -- sdk/ios` contains no `AppLink/InstallLinks.swift`; the file is untouched by all six commits and by the whole branch. Its only comment on the id is pre-existing and about storefronts, not environments (`InstallLinks.swift:2-4`). The reasoning was written into `12-alpha-audit-response.md:117` (parity F13) instead.
- **Residual severity**: nit — but it is the same class of error §6 of the response doc apologises for, one section earlier: a bullet that is directionally true and literally false. A reader who opens the file to check finds nothing.
- **What to do**: drop the bullet, or put one line in the file.

### P7. The `merge/execute` error contract still advertises a code the backend can no longer emit
- **Claimed in** `7a673da17`: *"`TARGET_NOT_FOUND` is gone"* (`12-alpha-audit-response.md:363`).
- **Reality**: gone from the orchestrator, still in the tests and still implied by the route. `services/backend/test/api/user/identity/merge.test.ts:256-281` asserts a 404 `TARGET_NOT_FOUND` — it passes only because it mocks `executeMerge` and rejects with the error itself, so it now tests a path no production code can produce. `api/user/identity/merge.ts:97-101` still declares `400`/`401`/`403` and no longer 404, which is correct, but nothing in the tree records that the target-absent case is now a **success**.
- **Residual severity**: low (dead test, misleading as documentation; a real regression here would stay green).
- **What to do**: delete or repoint that case; add the integration-level case for "absent target + valid proof ⇒ 200, created".

---

## NEW defects introduced

### N1. `merge/execute` now conjures any named `anonymousId` and folds it into the caller's group, with no proof and no auth
- **Severity**: **high** (security — identity/attribution capture). Bounded by the mitigations in §7 of the response doc (`WALLET_CONFLICT`, anchor direction, merchant scope), and by the pre-existing twin below, which is why it is high and not critical.
- **Axis**: correctness / security (backend trust boundary).
- **Complexity**: small (the audit's own sketch is ~10 lines).
- **Introduced by**: `7a673da17`, `AnonymousMergeOrchestrator.ts:211-221`.
- **Evidence**:
  - `executeMerge` calls `enforceProof` (`:198-203`) → `enforceLatchedProof`, whose proof-absent arm reads the node's latch and, finding **no node at all**, returns `false` = *allow* (`latchedProof.ts:60-73`).
  - `resolve` then runs unconditionally (`:216-221`); the audit's `found / not-found → require proof` branch does not exist anywhere in the file.
  - `/merge/execute` carries **no** auth predicate — no `withOptionalWalletOrSdkAuthent`, no session (`api/user/identity/merge.ts:63-103`); only a 20 req/min per-IP in-memory limiter (`:8`, `rateLimiter.ts` keys on `getClientIp`).
  - The token is obtainable by the attacker for their own group: `/merge/initiate` accepts a bare `sourceAnonymousId` with no proof for an unlatched id (`:41-50`, `AnonymousMergeOrchestrator.ts:122-130`).
  - `merchantId` is validated as a UUID only; `identity_nodes.merchant_id` has no FK (`domain/identity/db/schema.ts:61-76`), and `identity_value` is unbounded `text`.
  - No test covers the proofless path: both new tests pass `proof: "valid-proof"` with `verify → {valid:true}` (`AnonymousMergeOrchestrator.test.ts:338-402`).
- **What actually happens**: attacker calls `/merge/initiate` with their own (or a wallet-session) source, gets a token, then calls `/merge/execute` with `targetAnonymousId` = a victim id **that need not exist**, and no `proof`. The node is created unlatched, associated into the attacker's group, and — because it is created *unlatched* — stays proofless for the next attacker too. When the victim's device later starts sending interactions under that id it resolves into the attacker's group, so the theft is *prospective*: it works before the victim has any state to protect, which is precisely the window the 404 used to close. Anonymous ids are not secret — they ride in `?a=` on install deep links, install-page URLs and the Play referrer (`InstallLinks.kt:22-25, 38-44, 60-66`).
- **Answers to the two questions asked**:
  - **Idempotent/atomic under concurrency?** Yes. Two racing redemptions both miss `findGroupByIdentity`, both open a transaction, one loses `onConflictDoNothing` and deletes its orphan group (`IdentityOrchestrator.ts:34-57` + `IdentityRepository.ts:419-455`). The commit's race claim is accurate.
  - **Does permissive mode let a proofless request through?** The question does not arise, because there is no "valid proof required to auto-create" branch to bite. For completeness: this path uses the **enforcing** helper, not `verifyProofUnenforced` (`AnonymousMergeOrchestrator.ts:46-55`, context `"merge execute (Phase 4a: enforced)"`), so ROLLOUT-STEP-3 permissiveness is not what is letting requests through — the fail-open unlatched arm is, and it is fail-open by design.
- **Fix sketch** (unchanged from §3.3, and free for native):
  ```ts
  const existing = await this.identityRepository.findGroupByIdentity({ type: "anonymous_fingerprint", value: targetAnonymousId, merchantId });
  let targetGroupId: string;
  if (existing) { targetGroupId = existing.id; }
  else if (proofPresented) { targetGroupId = (await this.identityOrchestrator.resolve({...})).groupId; }
  else { throw HttpError.notFound("TARGET_NOT_FOUND", "Target anonymous identity not found"); }
  ```
  Plus one test: *"a proofless merge onto an unknown target keeps 404ing"*. And close the twin in `initiateMerge` (below) in the same pass, or the fix is theatre.

### N2. `carriesFrakParams` still probes `fmt` case-insensitively after `parseToken` went exact
- **Severity**: nit. **Axis**: correctness (dead work). **Complexity**: trivial. **Introduced by**: `94744d8b4`.
- **Evidence**: `DeepLinkObserver.kt:84` uses `query.get(IdentityMerge.TOKEN_KEY)` (case-insensitive fallback, `UrlQuery.kt:25-29`) while `IdentityMerge.parseToken` now uses `getExact` (`IdentityMerge.kt:37`).
- **What actually happens**: a `?FMT=…` link is classified as a Frak link, dispatched to `handleReferralLink`, and then does nothing (`DefaultFrakClient.kt:265-270` returns false). Harmless — the outcome matches web — but the two predicates now disagree about what a merge link is.
- **Fix sketch**: `query.getExact(IdentityMerge.TOKEN_KEY)` at `DeepLinkObserver.kt:84`.

---

## Audit claims this branch proves wrong

1. **"The 404 is currently an accidental guard against §2.2's attack" (§2.2, §3.3) — half wrong.** `initiateMerge` has always auto-created an arbitrary `sourceAnonymousId` and merged it into the caller's group without a proof when that id is unlatched — the behaviour is *documented as intentional* at `AnonymousMergeOrchestrator.ts:69-73` and implemented at `:122-150`, and with a wallet session it produces the same outcome N1 describes. So the audit over-credited `TARGET_NOT_FOUND`: it guarded one of two symmetric doors. N1 is still real (it removes a guard for the unauthenticated caller, and for ids that have never existed), but any remediation that closes only `executeMerge` leaves the finding open.
2. **"Leaving wallet.frak.id/ framable" (§10.3 nginx) — imprecise, and so is the team's correction.** The team is right that `location ~ \.html$` matches the request URI, so a bare `/` never entered the stripped block. But their before/after table (`12-alpha-audit-response.md:245-252`) tested `/`, `/index.html`, `/sharing`, `/sw.js`, `/app.css` — and no SPA client-side route. nginx's `try_files` makes an **internal redirect** to its last parameter when nothing matches, and an internal redirect re-runs location selection: `try_files $uri $uri/index.html /index.html` (`nginx.conf:159`) therefore serves *every* client-side route (`/membres`, `/sso`, …) as URI `/index.html`, inside the nested block. Pre-fix, that is five missing headers on the wallet's document for every deep link, not just for a direct `/index.html` hit. Not executed here (no nginx available) — flagged as reasoning, and moot for the post-fix state, but it means neither side's reproduction covered the largest instance.
3. **"`SharingWebViewPool.trim()` nulled pooled AND warmUrl and nothing re-warmed" (§10.3) — the second clause was too strong.** `present()` calls `warm()` before acquiring (`SharingHost.kt:301`), so the sheet was always correct, just cold. The team's severity call is right and mine was one notch high. The *foreground* re-warm is still missing (P3).
4. **The response doc's §7 withdrawal of §2.2 does not cover §3.3.** `7a673da17`'s message treats the two as one sequencing dependency. §2.2 is about the SDK auto-executing an attacker's `?fmt=` on the victim's device; N1 needs no SDK, no victim device and no `fmt` link at all — it is two unauthenticated HTTP calls. Withdrawing §2.2 does not retire the guard.

---

## Verified-OK

- **Race-safety of the new `resolve` path** — transaction + unique constraint + orphan rollback, exactly as claimed (`IdentityOrchestrator.ts:31-65`, `IdentityRepository.ts:419-455`). The negative-cache in `findGroupByIdentity` is evicted by `addNode` (`IdentityRepository.ts:430-434`), so a stale `null` cannot produce a duplicate group.
- **`markProofSeen` is genuinely a no-op on a missing node** — plain UPDATE with `isNull(proofSeenAt)` (`IdentityRepository.ts:132-151`). The commit's central justification for the reorder is true, and the order test asserts it rather than the outcome (`AnonymousMergeOrchestrator.test.ts:363-402`).
- **Ordering is otherwise safe** — `validateToken` runs before `resolve` (`AnonymousMergeOrchestrator.ts:205-221`), so an invalid or foreign-merchant token creates nothing.
- **nginx coverage is complete** — every block that declares an `add_header` includes the file. The one exception is the `if ($request_method = OPTIONS)` preflight block at `nginx.conf:80-86`, which declares four CORS headers and no include; nginx does not inherit into it, so a 204 preflight ships without the six. Not exploitable (a preflight response renders nothing) and the file's own header calls `if` out — noted for completeness, not filed.
- **Header set is the full six with `always`** — `nginx-security-headers.conf:8-19`; `Dockerfile:106-109` copies the template and the non-template include into the same final stage; `NGINX_ENVSUBST_FILTER='^MONERIUM_'` unchanged.
- **`isMemoryPressure` is correct** against every documented `TRIM_MEMORY_*` value, and is `internal` so the ABI dumps are unaffected (`frak-sdk-ui/api` untouched in `git diff --stat 6cd61d665 review/alpha-fixes`).
- **`await tracker.purge()` on iOS is not a deadlock** — `DefaultFrakClient` is an actor, awaiting another actor's method suspends rather than blocks (`DefaultFrakClient.swift:150-157`). The two residuals from round 2 remain: `queue.clear()` still truncates the whole file rather than purging by `clientId`, and an in-flight drain still holds its stale `currentClientId` snapshot.
- **`getExact`/`exactValue` semantics match** on both platforms: exact key, value still percent-decoded, `+`→space preserved. One asymmetry against web, in the safe direction: keys are stored raw, so `?%66mt=` is found by `URLSearchParams.get("fmt")` on web and not by native. Nit.
- **Native always sends a merge proof** (`MergeSender.kt:39-43`), so the audit's "this costs native nothing" premise for the N1 fix holds today.

---

### Ranking (worst first)

1. **N1** — proofless merge-target conjuring (`AnonymousMergeOrchestrator.ts:211-221`).
2. **P2** — ServerClock: bound that does not bind, no persistence, no wiring test, iOS absent, backend `MAX_FUTURE_SKEW_SECONDS` untouched.
3. **P4** — `SharingLinkBuilder.build` null: skipped and undisclosed.
4. **P5** — iOS custom-data bounds: skipped and dropped from the "honest list".
5. **P3** — no foreground re-warm.
6. **P7 / P6 / N2** — dead error contract, false commit-message bullet, mismatched `fmt` probe.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Review-only, read-only worktree. Sole artifact written is /tmp/frak-round3/backend-merge-and-round2.md, covering exactly the two assigned commits (7a673da17, 94744d8b4) and the five sub-checks in the brief; no repo file touched."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Every finding cites path:line on review/alpha-fixes (e.g. AnonymousMergeOrchestrator.ts:211-221, latchedProof.ts:60-73, api/user/identity/merge.ts:63-103, nginx.conf:47/56/66/104/140/152/167, SharingHost.kt:445/526-528, ServerClock.kt:49-50, IdentityProofService.ts:34, SharingApi.kt:15-18). Commands used to derive each claim are listed under commandsRun; unexecuted reasoning (nginx try_files internal redirect) is explicitly flagged as such."
    }
  ],
  "changedFiles": [
    "/tmp/frak-round3/backend-merge-and-round2.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git log -1 --format=%B 7a673da17 / 94744d8b4",
      "result": "passed",
      "summary": "Read both commit messages in full; treated as claims"
    },
    {
      "command": "git diff 7a673da17^ 7a673da17 -- services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.{ts,test.ts}",
      "result": "passed",
      "summary": "Confirmed unconditional get-or-create; only 1 of the audit's 3 prescriptions landed"
    },
    {
      "command": "git show review/alpha-fixes:services/backend/src/orchestration/identity/{AnonymousMergeOrchestrator,IdentityOrchestrator,latchedProof}.ts",
      "result": "passed",
      "summary": "Verified fail-open unlatched arm, race-safe resolve, initiateMerge's pre-existing auto-create twin"
    },
    {
      "command": "git show review/alpha-fixes:services/backend/src/api/user/identity/merge.ts + domain/identity/db/schema.ts + services/IdentityProofService.ts",
      "result": "passed",
      "summary": "No auth on /merge/execute; 20/min per-IP; no merchant FK; MAX_FUTURE_SKEW_SECONDS=60 untouched; merge window 600s"
    },
    {
      "command": "git grep -n TARGET_NOT_FOUND review/alpha-fixes -- services",
      "result": "passed",
      "summary": "Only the mocked route test still references it — dead path, still green"
    },
    {
      "command": "git show review/alpha-fixes:apps/wallet/nginx.conf + nginx-security-headers.conf + Dockerfile; git diff 94744d8b4^ 94744d8b4 -- apps/wallet/nginx.conf",
      "result": "passed",
      "summary": "7/7 add_header blocks include the six headers; only the OPTIONS if-block does not"
    },
    {
      "command": "git diff 94744d8b4^ 94744d8b4 -- sdk/android/.../SharingHost.kt + SharingHostMemoryPressureTest.kt; git show ...SharingWebViewPool.kt",
      "result": "passed",
      "summary": "Predicate fixed + 4 tests; trim() still nulls warmUrl; only onDestroy overridden — no foreground re-warm"
    },
    {
      "command": "git grep -rn 'ServerClock' review/alpha-fixes -- sdk/ios ; git diff --stat f1dc693 review/alpha-fixes -- sdk/ios",
      "result": "passed",
      "summary": "Zero iOS ServerClock hits; InstallLinks.swift untouched across the whole branch"
    },
    {
      "command": "git diff --stat 6cd61d665 review/alpha-fixes",
      "result": "passed",
      "summary": "SharingLinkBuilder/SharingApi/SharingSessionBuilder absent — P6 of round 2 skipped silently"
    },
    {
      "command": "bun run test (backend)",
      "result": "not-run",
      "summary": "Brief forbids execution; no toolchain assumed. All findings are source-read."
    }
  ],
  "validationOutput": [
    "7a673da17: 3 audit prescriptions for §3.3 — (a) auto-create only in the proof-verified branch: ABSENT; (b) keep TARGET_NOT_FOUND without a valid proof: ABSENT; (c) markProofSeen after the node exists: PRESENT (AnonymousMergeOrchestrator.ts:223-231).",
    "94744d8b4 round-2 items: nginx = complete (7 include sites + Dockerfile); TRIM_MEMORY guard = fixed, foreground re-warm = missing; ServerClock = 2 of 5 (bound nominal at 2100, KDoc fixed; persistence, wiring test, iOS port, backend skew all open); SharingLinkBuilder null = untouched; iOS custom-data bounds = untouched and undisclosed; iOS resetAnonymousId await = fixed."
  ],
  "residualRisks": [
    "N1 is a security finding derived by reading code paths; no request was actually issued against a running backend, so the attack is reasoned end-to-end (route -> orchestrator -> repository) rather than demonstrated.",
    "The nginx try_files internal-redirect claim (audit-wrong item 2) is nginx-semantics reasoning; no nginx/docker was available to reproduce. It does not affect the post-fix state, only the accuracy of both parties' before/after tables.",
    "Kotlin/Swift behaviour is read, not compiled or run (no JDK/Swift toolchain, no device)."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository changes. One review artifact written to /tmp/frak-round3/backend-merge-and-round2.md.",
  "reviewFindings": [
    "blocker: services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts:211-221 - unconditional get-or-create of the merge target; the audit's proof-gated branch and the TARGET_NOT_FOUND fallback were not implemented, and /merge/execute is unauthenticated (api/user/identity/merge.ts:63-103). No test covers the proofless path.",
    "major: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/ServerClock.kt:49-50 - the new upper bound (2100-01-01) does not reject the failure the finding names; not persisted, no wiring test, iOS still has no ServerClock, IdentityProofService.ts:34 MAX_FUTURE_SKEW_SECONDS=60 untouched.",
    "major: sdk/android/.../sharing/SharingLinkBuilder.kt:24-25 vs SharingApi.kt:15-18 - the published buildLink contract is still contradicted; skipped and not listed in the response doc's 'honest list'.",
    "minor: sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift:391-395 - iOS custom-data bounds still absent, and the row was dropped from 12-alpha-audit-response.md's disclosure (only the byte cap is listed).",
    "minor: sdk/android/frak-sdk-ui/.../SharingHost.kt:445 - no onStart/onResume, so nothing re-warms on foreground after a genuine pressure trim.",
    "nit: 94744d8b4's InstallLinks.swift bullet is false — the file is untouched by every commit on the branch."
  ],
  "manualNotes": "Two places where the audit itself is wrong, both stated in the report: (1) TARGET_NOT_FOUND was never the only guard — initiateMerge's documented auto-create arm (AnonymousMergeOrchestrator.ts:69-73,122-150) has always allowed the same proofless fold with a wallet session, so a fix that closes only executeMerge is incomplete; (2) my own round-2 claim that 'nothing re-warms' was one notch too strong — present() does re-warm (SharingHost.kt:301), the cost is coldness, not breakage. Also: the team's nginx correction about '/' is right as far as it goes, but their before/after table never tested a SPA client-side route, which try_files serves through the same stripped block via an internal redirect."
}
```
