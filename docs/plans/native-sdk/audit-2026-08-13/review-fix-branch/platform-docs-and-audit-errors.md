# Backend + wallet fixes, and auditing the audit — `review/alpha-fixes` (f1dc693 → d88272d98)

Scope: `f6ff19afc` (backend/wallet) and `d88272d98` (docs/register/READMEs/tooling), plus a
re-check of every audit finding that rested on git history. All claims below are read from
`git archive review/alpha-fixes` unpacked at `/tmp/fx/branch` (paths are repo-relative) and from
the full 6117-commit history. No JDK/Android SDK/Swift toolchain used; `bun` was used only to run
`scripts/check-comments.ts`.

## Verdict

Mergeable for an alpha in my area, with one item I would fix before merge and four I would file.
The wallet nginx fix is correct *where it was applied* and the nginx semantics claim is accurate —
but it patched the two blocks the audit named and left the identical bug in four more blocks of the
same file, including the one that serves the SPA's own `index.html`, so `wallet.frak.id/` is still
framable by any origin. That is the one blocker-shaped residual. The `frak-merge-v1` widening lands
mechanically but its stated justification is wrong on both counts (the bound token is a *stateless
60-minute JWT with no replay cache*, and a queued retry never consumed the window because the proof
is minted per attempt), and it is one-sided: `MAX_FUTURE_SKEW_SECONDS = 60` is untouched, so a
device 61 s **fast** still 403s every merge — on iOS, which got no `ServerClock`, that is the whole
population the fix was for. `sharingTimestamp` is bounded correctly but only on one of the two
fields that feed the same `::int` join. The rate-limit "test that uses the production registration
order" does not import the production module and cannot fail if the production order changes.

On auditing the audit: `d88272d`'s two headline corrections are **right**, and I can prove the
audit's error more precisely than the branch does — the commit the audit cited as sole origin of
`checkDexSizeBudget` (`32ecd20`) contains zero occurrences of the string; it was the shallow clone's
graft boundary. But the branch over-corrects in three places, most damagingly by writing
"**No simulator UI pass has run**" into `03-sharing-and-install.md` when `0c978b12f`'s own message
records one, and by re-measuring §3.7 against the *pre-fix* tree.

---

## Fixes that land

- **backend F3 (ROLLOUT.md stale "no prod migration")** — sentence replaced with the three real file
  names; verified: `services/bootstrap/drizzle/prod/0020_gigantic_black_crow.sql:1` is
  `ALTER TABLE "identity_nodes" ADD COLUMN "proof_seen_at" timestamp;` (also `dev/0040_*.sql:1`,
  `local/0035_*.sql:1`). `docs/plans/identity-proof-of-possession/ROLLOUT.md:63-65`.
- **backend F5 (`isDuplicate` comment)** — the false claim is gone; `services/backend/src/api/user/track/interaction.ts:58-63`. Re-verified: `isDuplicate|interactionLogId|identityGroupId|referralLinkId|pendingWebhook|finalGroupId` across `sdk/android` + `sdk/ios` hits **test files only** (3 files), and `isDuplicate` appears in no `apps/`, `packages/` or `sdk/core` TS either.
- **backend F4 doc half** — `docs/plans/native-sdk/01-platform-changes.md:119-122` now states the
  effective 60/min, and the registration site carries it at
  `services/backend/src/api/user/merchant/index.ts:143-146`. (The *test* half does not land — see P3.)
- **wallet F5 (the two blocks the audit named)** — all six server-level headers re-declared verbatim,
  same values, all `always`, in both blocks: `apps/wallet/nginx.conf:153-158` and `:171-176` against
  the server block at `:48-59`. **The nginx semantics claim is correct**: `add_header` is inherited
  from the enclosing level *if and only if* the current level declares none, and both blocks already
  declared `Cache-Control`/`Pragma`/`Expires`, so the six really were being stripped.
- **wallet F8 (`bindI18nStore`)** — `apps/wallet/app/entry/shared/bootstrap.tsx:125-129` and
  `apps/wallet/app/main.tsx:162-166`. Traced: `initI18n` registers a `languageChanged` handler that
  `await import`s the `en` bundle and calls `addResourceBundle` (`bootstrap.tsx:84-94`), which emits
  the store `added` event, not `languageChanged`; react-i18next's default `bindI18nStore: ""` ignores
  it. With `"added"` the English device re-renders. Matches the in-repo precedent
  (`apps/business/src/main.tsx:57`). Residual nit: the flash of French before the dynamic import
  resolves remains — the fix converts "French forever" into "French for one frame".
- **register 9.1 / 9.16 / 9.13 revert notes** — accurate. `AttributionLedger`, `abandonGrace`,
  `selfUntilSettled`, `pendingLaunch`, `pendingReports`: zero source hits (one stale prose mention at
  `sdk/android/frak-sdk-ui/.../SharingOutcome.kt:11`). No `Atomic*` anywhere in
  `sdk/android/frak-sdk-ui/src/main`. The replacement is real:
  `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:144-149` `private enum Phase { idle, live, reported }`.
  The revert is `0c978b12f` ("Deleted with it: the deferred-attribution machinery … `selfUntilSettled`,
  `abandonGrace`, `pendingLaunch` and `pendingReports`") — worth citing in the register, which does not.
- **register A7 "seventeen twins for seventeen members"** — reproduced: 17 `*Async` entries in
  `sdk/android/frak-sdk/api/frak-sdk.api` and 17 `public suspend fun` in `frak-sdk/src/main`.
  The old "eighteen for fifteen" was wrong.
- **register `@InternalFrakApi` count** — reproduced: 4 Android declaration sites
  (`FrakSdkVersion.kt:14,22,27`, `PercentEncoding.kt:10`) and 7 Swift `@_spi(FrakInternal)`
  declarations (10 grep hits minus 3 `import` lines).
- **Android test count 536 (392 + 144)** — reproduced **exactly**: `grep -rn "@Test"` gives 392 in
  `sdk/android/frak-sdk/src/test` and 144 in `frak-sdk-ui/src/test`, and every hit is a bare `@Test`
  line (no comment/false positives).
- **PRIVACY.md (merchant-dx F17)** — retention sentence now names the caps, and both are real:
  `EventQueue.kt:376` `MAX_EVENTS = 1000`, `:379` `MAX_BYTES = 2 MiB`. Header casing corrected to
  `x-frak-sdk-version`, matching `FrakSdkVersion.kt:15`. Parity claim downgraded to "hand review".
- **Android README merchant section (F1/F2/F3/F6/F14/F16/F19)** — all six land and the snippet is
  real API: `FrakConfig.Builder(String)` (`FrakConfig.kt:122-124`, dump `:221`),
  `.logLevel(FrakLogLevel)` (`:155`, dump `:233`), `Frak.initialize(Context, FrakConfig)`
  (dump `:22`). `FrakLogger` removed from the public list (it is `internal`, `FrakLogger.kt:9`).
- **iOS mirror README (F4)** — the quickstart now compiles by inspection: `Frak.client` is a
  `get throws` (`Frak.swift:114-115`) so `try` is required; `best(targetInteraction:)` is
  `async throws` with all-defaulted labels (`RewardsAPI.swift:26-31`);
  `purchase(customerId:orderId:token:)` returns `Result` and does not throw (`TrackingAPI.swift:14`);
  `FrakConfig(merchantId:metadata:logLevel:)` is in declaration order (`Core/FrakConfig.swift:85-93`);
  `frakwallet` is the production scheme (`Core/FrakEnvironment.swift:48`). Info.plist/Associated
  Domains/`SceneDelegate` section is new and correct (`handleReferral` is `@discardableResult`,
  `AppLinkAPI.swift:9-16`).
- **Tooling** — `validate-wrappers: true` on both Gradle workflows; the Central upload no longer
  reports a validation timeout as success (`release-android-sdk.yml`, `case "$state" in VALIDATED|PUBLISHED`);
  `sdk/android/scripts/run.sh:24-33` JDK-17 warning. `bun run scripts/check-comments.ts` against the
  branch tree: **clean across 276 files** (99 baselined), and `sdk/ios/Package.swift` /
  `example/native-ios/Package.swift` are now roots (`scripts/check-comments.ts:22,24`).

---

## Fixes that DO NOT fully land

### P1. wallet F5 — the same bug is still live in four more blocks of the same file, including the one serving the SPA document

- **Claimed in**: `f6ff19afc` — *"`/sharing` and `/install` re-declare the six server-level security
  headers. nginx inherits `add_header` only when the current block declares none, so both paths were
  shipping with X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP and XSS-Protection stripped"*
  — and the in-file comment at `apps/wallet/nginx.conf:149-152`: *"Keep in step with the `# Security headers` block above."*
- **Reality**: the rule the comment states applies to every block in the file that declares any
  `add_header`. Four still do and none re-declares the six:
  - `apps/wallet/nginx.conf:186-192` — `location ~ \.html$` nested in `location /`, declaring only
    `Cache-Control`/`Pragma`/`Expires`/`X-Content-Type-Options`. `try_files $uri $uri/index.html /index.html`
    (`:184`) internally redirects to `/index.html`, which re-matches `location /` and then this nested
    regex, so **the wallet SPA's own document ships without `X-Frame-Options`, `X-XSS-Protection`,
    `Referrer-Policy`, `Permissions-Policy` and COOP**.
  - `:71-77` — every hashed JS/CSS/font asset (declares `Cache-Control "public, immutable"`).
  - `:62-68` — `location = /sw.js` (also loses `nosniff`).
  - `:84-114` — the Monerium proxy block (declares ACAO/`Vary`).
  The repo already knows the fix shape: `apps/business/nginx.conf:36-47,62-67` repeats all five in
  both child blocks, with the comment *"add_header in a child block replaces parent headers, so
  security headers must be repeated"*. The wallet file did not get that treatment.
- **Residual severity**: **high**. The SPA document is the passkey/wallet surface; `SAMEORIGIN` on
  the two SDK pages while the wallet itself is frameable is the wrong half to have fixed first.
- **What to do**: repeat the six in `location ~ \.html$` (and `nosniff`+the rest in the asset and
  `sw.js` blocks), or hoist them into an `include`d snippet as `apps/listener/security-headers.conf`
  already does. Before flipping XFO on the SPA, confirm no first-party embedder frames it — the
  listener is a separate app on `/listener` with its own conf and uses CSP `frame-ancestors`
  (`apps/listener/security-headers.conf:2`), so nothing in-repo should break.
  There is no test of any kind over `nginx.conf`; a `nginx -T` + `curl -I` smoke check in CI would
  have caught both the original and this residual.

### P2. backend F6 — the merge window is widened on the past side only, and both stated justifications are false

- **Claimed in**: `f6ff19afc` — *"The token it binds is single-use and short-lived, so replay is
  bounded by the token; the window only has to survive an unsynchronised device clock and a queued
  retry, and a 2-minute one loses to both."*
- **Reality**:
  1. **The token is not single-use.** It is a stateless JWT with no consumption record:
     `services/backend/src/domain/identity/services/AnonymousMergeService.ts:38` signs it, `:67`
     verifies it, and nothing marks it used — `AnonymousMergeOrchestrator.executeMerge`
     (`:180-218`) calls `validateToken` and then `associate`, with no replay cache. The tree's own
     comment says so: `AnonymousMergeOrchestrator.ts:186-188` — *"a stolen proof is useless without
     the exact, **60-min-lived** token"*.
  2. **It is not short-lived relative to the window.** `AnonymousMergeService.ts:36` /
     `infrastructure/external/jwt.ts:44-47`: 60 minutes. The proof window is therefore still the
     tighter bound, and the replay window for a captured `(proof, token)` pair goes from 2 min to
     10 min — a 5× widening, not a no-op. (Still low risk: both travel in one TLS body, and
     `markProofSeen` latches the identity.)
  3. **A queued retry never consumed the window.** The merge proof is minted at drain time on both
     platforms — `sdk/android/.../tracking/MergeSender.kt:36-41` ("Minted on every attempt, never
     cached"), `sdk/ios/.../Tracking/MergeSender.swift:36-41`. The audit said this itself
     (`audit-2026-08-13/android-core.md:184`). So the only real driver was clock skew.
  4. **The window is asymmetric and the asymmetric half is untouched.**
     `IdentityProofService.ts:34` `MAX_FUTURE_SKEW_SECONDS = 60` and `:65`
     `if (ts > now + MAX_FUTURE_SKEW_SECONDS) return false`. A device **61 s fast** still fails every
     merge, which is half of the audit's own F6 population (*">60 s fast or >120 s slow"*).
  5. **Only Android got the client-side half.** `ServerClock` is Android-only
     (`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/ServerClock.kt`, wired at
     `AnonymousIdStore.kt:46,89` and `HttpClient.kt:183`); iOS still stamps raw device time at
     `sdk/ios/Sources/FrakSDK/Identity/AnonymousIdStore.swift:71`
     (`ts: Int64 = Int64(Date().timeIntervalSince1970)`). So on Android the widening is
     belt-and-braces; on iOS it is the only mitigation, and it is the wrong half of it.
     (`12-alpha-audit-response.md:47` §3.7 does disclose this honestly — the *commit message* does not.)
  6. **Not tested on the axis that is still broken.** `IdentityProofService.test.ts:84,96` were
     edited from ±2 to 10 min, but the future-skew test at `:108-118` exercises `frak-ensure-v1`
     only. Nothing pins that `frak-merge-v1` rejects at `now + 61`.
- **Residual severity**: medium.
- **What to do**: either raise `MAX_FUTURE_SKEW_SECONDS` per-op (a `PROOF_FUTURE_SKEW_SECONDS`
  record mirroring the window record), or port `ServerClock` to
  `sdk/ios/.../Net/HTTPClient.swift` + `AnonymousIdStore.swift` (mechanical). Add a
  `frak-merge-v1` future-skew test either way, and correct the source comment at
  `IdentityProofService.ts:18-21`, which currently repeats the false "single-use" premise.

### P3. backend F4 — the new test cannot fail if the bug returns

- **Claimed in**: `f6ff19afc` — *"pinned by a test that uses the production registration order — the
  existing one registered all three limiters first and could not see it"*.
- **Reality**: the new case at `services/backend/src/api/user/merchant/index.test.ts:337-369` builds
  a **synthetic** `new Elysia()` with hand-written `fakeLimiter` stubs and its own
  `/merchant/resolve` + `/merchant/estimated-rewards` routes. It never touches `userMerchantApi`
  (imported at `:13` and used only by the `formatted`-query tests). It *replicates* the production
  order by hand; it does not read it. Move the 90-limiter above `/resolve`, scope it into a
  sub-instance, or delete it entirely in `index.ts` and this test stays green. What it actually pins
  is Elysia's `.as("scoped")` semantics — useful, but that was already pinned by the two neighbouring
  cases (`:306-335`, `:370-392`).
- **Also incomplete**: the additive effect is documented for one of three layers.
  `services/backend/src/api/user/merchant/index.ts:205-206` mounts `exploreApi` (own 30/min limiter,
  `explorer.ts:8`) and then `merchantReferralStatusRoute` — with `rateLimitMiddleware` returning
  `.as("scoped")` (`infrastructure/rateLimit/rateLimiter.ts:213`), those routes are charged to
  60 **and** 90 **and** 30. Neither the new comment nor `01-platform-changes.md` says so.
- **Residual severity**: medium (test quality) / low (behaviour, which is documented-as-is).
- **What to do**: assert against `userMerchantApi` itself — spy the limiter store or count 429s by
  driving 61 requests at `/merchant/estimated-rewards` from one IP — and extend the comment to name
  the explorer bucket.

### P4. backend F12 — `sharingTimestamp` is bounded; `referralTimestamp`, the other half of the same join, is not; the SDKs got a doc comment

- **Claimed in**: `f6ff19afc` — *"`sharingTimestamp` is bounded to what the `::int` cast in the
  rewards schema can hold"*.
- **Reality**: the bound itself is right —
  `services/backend/src/api/schemas/interactionSchemas.ts:19-22`
  `t.Integer({ minimum: 0, maximum: 2_147_483_647 })` matches int4 and matches the partial expression
  index at `services/backend/src/domain/rewards/db/schema.ts:53-55`. But:
  - **`referralTimestamp` is still `t.Optional(t.Number())`** (`interactionSchemas.ts:13`), and it is
    the *other side of the same comparison*: `ArrivalHandler.ts:44,86` writes it to
    `referral_links.sourceData.sharedAt`, `RewardHistoryOrchestrator.ts:241` reads it back, and
    `InteractionLogRepository.ts:90-95` feeds it into
    `inArray(sql\`(payload->>'sharingTimestamp')::int\`, params.sharingTimestamps)`. The FrakContext
    v2 codec legalises `t` up to **uint32** (`sdk/core/src/context/frakContextV2Codec.ts:16`,
    `frakContextV2Codec.test.ts:93-94` asserts `4_294_967_295` round-trips), i.e. values above int4
    max are valid on the frozen wire format and reach this query from any crafted referral link
    (`sdk/android/.../applink/ReferralArrival.kt:54`, `sdk/ios/.../AppLink/ReferralArrival.swift:38`,
    `sdk/core/src/actions/referral/processReferral.ts:65`).
  - **The SDKs changed only a doc comment** — `Interaction.kt:58-62`, `Interaction.swift:34` now say
    "Unix SECONDS"; the parameter is still an unlabelled `Long`/`Int64`, there is no enqueue-time
    guard, and the audit's other suggestion (rename to `sharingTimestampSeconds`) was not taken.
  - **No test** covers the new bound — there is no test file for `interactionSchemas.ts` anywhere.
- **Behaviour change worth stating**: a millis value now 422s. `classifyStatus`
  (`sdk/android/.../tracking/RowSender.kt:29-42`) maps non-429/non-5xx to `Rejected`, and
  `EventOutbox.kt:272-276` (post-96024ee) `continue`s past it — so the sharing event is dropped after
  the failure cap with one `logger.warn`. This is **better** than before, not worse: see A4 below.
- **Residual severity**: medium.
- **What to do**: bound `referralTimestamp` the same way (or widen the SQL cast to `bigint`), and add
  a schema test with `2_147_483_648` and `Date.now()`.

### P5. audit §3.4 (native forwards no locale) is untouched and still open

- **Claimed in**: nothing — but `f6ff19afc`'s i18n bullet is the only i18n change in the branch, and
  the two bugs are easy to conflate.
- **Reality**: `grep -rni "lang|locale"` over `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/*.kt`
  and `sdk/ios/Sources/FrakSDKUI/*.swift` returns **zero matches** on the branch. `fallbackLng` is
  still `"fr"` and `supportedLngs` is still `["en","fr"]`
  (`packages/wallet-shared/src/i18n/config.test.ts:20-27`). So: **F8 is closed, §3.4 is open.** An
  English device now renders English (its WebView reports `navigator.language`, which the detector's
  `navigator` rung picks up); a German or Spanish device still gets a French sheet, and the merchant
  still has no knob. The detector's first rung is `querystring` (`bootstrap.tsx:116-124`), so
  appending `&lng=` in `SharingPageUrl.kt` / `SharingPageURL.swift` is still the one-line fix.
- **Residual severity**: medium (unchanged from the audit).

### P6. `lint:comments` runs in CI only when `sdk/android/**` changes

- **Claimed in**: `d88272d98` — *"`lint:comments` now runs in CI. It was the only gate on the
  Kotlin/Swift comment budget and ran in no workflow."*
- **Reality**: the step is inside the `android-sdk` job (`.github/workflows/apps.yaml`, step
  `"🗒️ Comment budget"`), and that job is `if: needs.changes.outputs.android == 'true'` with the
  filter `sdk/android/**` + the workflow file (`apps.yaml:47-49,118-122`). The checker's roots
  (`scripts/check-comments.ts:15-25`) include `sdk/ios/Sources`, `sdk/ios/Tests`,
  `sdk/ios/Package.swift`, `example/native-android/app/src`, `example/native-ios/Sources`,
  `example/native-ios/Package.swift`. A Swift-only PR never runs it; worse, the workflow's top-level
  `paths:` is `['apps/**','packages/**','sdk/**','bun.lock','.github/workflows/apps.yaml']`
  (`apps.yaml:6,8`) — `example/**` cannot trigger this workflow at all, so three of the eight roots
  are unreachable by any path.
- **Residual severity**: low. **What to do**: duplicate the step into `ios-sdk`, or give it its own
  job with no `changes` gate (it is a 2-second bun script).

### P7. merchant-dx F5 — the iOS "Public API surface" table is retitled but still not an inventory, and the new blanket sentence is wrong

- **Claimed in**: `d88272d98` — *"`sdk/ios/README.md`'s 'Public API surface' table listed ~20
  internal types as public; it is now titled 'Internal layout' and says so."*
- **Reality**: the retitle and the `InteractionTracker`→`EventOutbox` correction are right
  (`sdk/ios/README.md:45-63`). But the new prose says *"**Almost none of these are `public`** … Everything
  else below is `internal`"*, and the very first table row lists `FrakConfig`, `FrakLogSink`,
  `FrakEnvironment`, `FrakMetadata`, `FrakError` — **all five are `public`** (`Core/FrakConfig.swift:62,38`,
  `Core/FrakLogger.swift:11`, `Core/FrakEnvironment.swift:4`, `Core/FrakError.swift:4`), alongside three
  that are internal (`FrakLogger.swift:16`, `Base64URL.swift:6`, `Hex.swift:5`). F5's actual ask —
  *"give the merchant-facing README a single 'Public API' list that matches reality"* — is not done;
  `README.mirror.md` still has prose and snippets but no inventory, and iOS still has no ABI dump.
- **Residual severity**: low.

---

## NEW defects introduced by this branch

### N1. `03-sharing-and-install.md` now asserts a simulator UI pass never happened — it did

- **Severity**: medium
- **Axis**: docs-accuracy (the exact failure mode the audit's §6 named: *"a register that undersells
  is as expensive as one that oversells"*)
- **Complexity**: trivial
- **Introduced by**: `d88272d98`
- **Evidence**: `docs/plans/native-sdk/03-sharing-and-install.md:250-252` now reads *"**No simulator
  UI pass has run.** This paragraph used to claim one, driven by XCUITest; there is no XCUITest target
  … and no workflow invokes `xcodebuild test`."* And `sdk/ios/README.md:95-98` goes further: *"any
  claim of a simulator UI-test pass elsewhere in `docs/plans/native-sdk/` is wrong."*
  Against `git log -1 --format=%B 0c978b12f` (2026-08-12, an ancestor of the base):
  *"**Verified on an iOS 26 simulator with a throwaway XCUITest driver**: tap-outside, drag-down,
  reopen, scope-switching and a binding that starts true (a path nothing had ever exercised).
  454 host tests green."*
- **What actually happens**: the branch deletes a true, load-bearing piece of evidence and replaces
  it with its negation, then instructs future readers to disbelieve the true version. It also
  contradicts the same branch's own `AGENTS.md:59` and `sdk/AGENTS.md:62` ("iOS since 2026-08-12")
  and its own `12-alpha-audit-response.md`, which lists an iOS device run as *still needed* while the
  README says one started.
- **Fix sketch**: *"One simulator UI pass has run (`0c978b12f`, iOS 26 — tap-outside, drag-down,
  reopen, scope-switching), driven by a throwaway XCUITest driver that was never committed. There is
  no XCUITest target in `example/native-ios/project.yml`, no workflow invokes `xcodebuild test`, and
  nothing in the repo can reproduce it."*

### N2. §3.7's "corrected" line count was measured on the pre-fix tree and is stale in its own commit

- **Severity**: low
- **Axis**: docs-accuracy
- **Complexity**: trivial
- **Introduced by**: `d88272d98`
- **Evidence**: `docs/plans/native-sdk/06-open-findings.md:119` — *"**325 lines of code (507 raw) as of
  2026-08-13**"*. The six files §3.7 names total **507 raw at `f1dc693`** (57+107+110+75+89+69) and
  **552 raw on this branch** (`sdk/core/src/utils/url/queryParams.ts` 57,
  `sdk/android/.../net/UrlQuery.kt` **144**, `sdk/ios/.../Net/URLQuery.swift` 109,
  `sdk/core/src/context/mergeAttribution.ts` 75, `sdk/android/.../sharing/AttributionParams.kt` 89,
  `sdk/ios/.../Sharing/SharingLinkBuilder.swift` **78**). `96024ee38` grew `UrlQuery.kt` by 37 lines
  and `SharingLinkBuilder.swift` by 9 in the same PR.
- **What actually happens**: the correction to a stale number is itself stale by 45 lines, and the
  un-pinned surface §3.7 is about got 9% larger in the commit that "corrected" it.
- **Fix sketch**: 552, and cite the `wc -l` command as the row now tells readers to do.

### N3. `06-open-findings.md` still lists the dex budget inside `check`, and still carries the counts the same commit calls wrong

- **Severity**: low
- **Axis**: docs-accuracy (incomplete correction)
- **Complexity**: trivial
- **Introduced by**: `d88272d98` (missed)
- **Evidence**: `docs/plans/native-sdk/06-open-findings.md:167` — *"`check` (ktlint, `assembleRelease`,
  JVM tests, `apiCheck`, Android Lint, **dex budget**, version drift) green, **iOS 396 tests in 42
  suites** green."* The same file's header (`:5`) now says those figures *"were already wrong when
  written"*, and `:26` says the budget is not part of `check`. Also `docs/plans/native-sdk/09-android-api-surface.md:602`
  still lists "the dex budget" among items closed by the dump.
- **Fix sketch**: two edits; the commit claimed six documents were swept and this one was swept
  incompletely.

### N4. `09` §5b's `321 KB` → `318 KB` rewrite contradicts the commit that produced the measurement

- **Severity**: nit
- **Axis**: docs-accuracy
- **Introduced by**: `d88272d98`
- **Evidence**: `09-android-api-surface.md:712-713` now says *":frak-sdk measured **318 KB**,
  :frak-sdk-ui 161 KB"*, taken from `32836c217`'s message. The row describes the *first* run, and
  that run is `fc069c9be` — *"The dex budget goes 256 → 384 KB, the first figure ever measured rather
  than guessed (`:frak-sdk` **321 KB**, `:frak-sdk-ui` **162 KB**)"*. The branch replaced the correct
  number for the event the row describes with a number from a different run a day later. Neither is
  checkable without a JDK.
- **Fix sketch**: keep 321/162 for the first run and note 318/161 at the retirement, or say both.

### N5. `ServerClock`'s KDoc states a backend window this same branch changed

- **Severity**: nit (but it is the file a reader consults to reason about proof freshness)
- **Axis**: docs-accuracy / correctness comment
- **Introduced by**: `96024ee38`, made wrong by `f6ff19afc` in the same branch
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/ServerClock.kt:7-10` — *"The
  backend rejects a proof more than 60 s in its future, and a merge proof outside a **2-minute
  window**"* vs `services/backend/src/domain/identity/services/IdentityProofService.ts:24`
  `"frak-merge-v1": 10 * 60`. The derived constant is also justified against the stale number:
  `:41-42` *"Half the tightest server window"* for `DRIFT_WARN_MILLIS = 30_000`.
- **Fix sketch**: one line; and while there, `IdentityProofService.ts:18-21` should stop asserting
  the token is single-use (see P2).

### N6. `12-alpha-audit-response.md` links to two paths that do not exist on this branch

- **Severity**: nit
- **Axis**: docs structure
- **Introduced by**: `d88272d98`
- **Evidence**: `docs/plans/native-sdk/12-alpha-audit-response.md:3` links
  `[11-alpha-audit.md](./11-alpha-audit.md)` and `[audit-2026-08-13/](./audit-2026-08-13/)`;
  `git ls-tree review/alpha-fixes docs/plans/native-sdk/` lists neither (they exist only on
  `audit/native-sdk-alpha`). Every `§n.n` reference in the response is unresolvable for anyone on
  `dev` after this merges. `docs/plans/native-sdk/README.md` also does not index `12`.
- **Fix sketch**: merge the audit tree alongside, or inline the finding titles.

### N7. Mirror-README comment names the wrong accessor

- **Severity**: nit
- **Axis**: docs vs API
- **Introduced by**: `d88272d98`
- **Evidence**: `sdk/ios/README.mirror.md` — *"// `try`, because both the `client` getter and `best`
  throw."* on a line that uses `Frak.clientOrNull`, which is a plain `public static var … -> FrakClient?`
  and does **not** throw (`sdk/ios/Sources/FrakSDK/Frak.swift:126-131`); only `best` does. The code
  compiles; the comment teaching the merchant why does not match it.

---

## Audit claims this branch proves wrong (and one it proves wrong more sharply than it says)

1. **`checkDexSizeBudget` "does not exist and never has" — WRONG, and the cited evidence is a shallow-clone artefact.**
   `d88272d` is right that it existed (`cd50f13f8` added it, `32836c217` removed it on 2026-08-07).
   I can go further: `register-challenge.md:24` says *"`git log --oneline -S "checkDexSizeBudget" --all`
   → one commit, `32ecd20`, which only added the doc text."* `32ecd209f` is
   *"feat(native-ios): add an App Store invite presenter harness"* (2026-08-12) and **its diff
   contains zero occurrences of the string** (`git show 32ecd209f | grep -c checkDexSizeBudget` → 0).
   It is 22 commits before `f1dc693` — the graft boundary of the audit's clone, which `-S` reports as
   the origin of every string in the tree. The audit built its single strongest conclusion
   (*"the one place the register asserts an executed result that provably did not happen, which
   contaminates every other 'verified this pass' claim"*) on a commit id it mis-attributed. Every
   `git log`-derived claim in `audit-2026-08-13/` should be re-run; the ones I re-ran
   (`eccb8c2`/`3a8da9b` having subject-only messages) hold.

2. **§3.1 "Nothing in this repo has ever run R8" — wrong as a literal statement, right in substance.**
   `32836c217` measured through R8's `mapping.txt` against a minified `example/native-android`
   release APK. But *R8 has run* ≠ *a minified build is verified to work*, and the branch's own
   framing (`12-alpha-audit-response.md:47`) is the honest one. Concretely, all of this survives:
   the harness's committed config is still `isMinifyEnabled = false`
   (`example/native-android/app/build.gradle.kts:29` — `32836c217` did not touch that file, so the
   R8 run was a local flip that was never committed); no R8 build is reproducible from a clean
   checkout or run in CI; both `consumer-rules.pro` files are still empty and still assert nothing is
   reflective while `SharingHost.kt` enters the sheet through
   `ViewModelProvider(activity)[SharingViewModel::class.java]`; and the removal commit's own headline
   number — *"R8 shakes out 46% of the SDK's classes in a merchant build"* — is the reason to worry,
   not the reason not to. **§3.1 survives as a P1 minus one sentence.** The audit's underlying
   concern (a gate that watched the wrong number) is also vindicated by the removal commit, which
   agrees with it.

3. **Test counts — the branch's correction is right for Android and unfair in its framing.**
   Android at the branch tip is **exactly 536 (392 + 144)**, reproducible by grep. But the audit's
   "514" was measured at `f1dc693`, where the same grep gives **515** — off by one, not by 22. The
   22 extra tests are ones *this branch added*. `d88272d`'s *"Headline counts were wrong when
   written"* is true of the register's 451/396; it is not a fair verdict on the audit's numbers,
   which were nearly right for the tree the audit read. iOS: neither number is reproducible
   statically — I count **502** `@Test` declarations in **54** `@Suite` declarations at the tip
   (498/54 at the base), against the audit's 473/51 and the branch's 495/53. The suite figure
   reconciles (54 declared, one `@Suite(… .enabled(if: HostKeyMaterial.isMintable))` at
   `PersistedDeviceKeyStoreTests.swift` skips → 53); the test figure does not, in either direction,
   once you account for one `arguments: 0..<20` parameterised case and one `.disabled(`. **495 is
   still an asserted number a reader cannot check** — exactly what the audit's §6 recommendation was
   about. Print the command and its output next to it.

4. **backend F12's mechanism is wrong, and the real one is worse than the audit said.**
   The audit (`backend-contract.md:333-335`): *"the insert succeeds (it is JSONB) and the failure
   surfaces later, inside the reward-history join"*. Postgres evaluates a partial expression index at
   INSERT for rows matching its predicate, and `SharingHandler.getInteractionType` returns
   `"create_referral_link"` (`SharingHandler.ts:25-27`), which is exactly
   `schema.ts:55`'s `WHERE "type" = 'create_referral_link'`. So an over-`int4` value made the
   **write** fail → 500 → `classifyStatus` → `Retryable` → `EventOutbox` `break` (`EventOutbox.kt:266-269`),
   i.e. a poison row that stalled the whole drain rather than a latent join failure. The bound is
   therefore a bigger win than either document claims — worth saying, since it is the strongest
   argument for also bounding `referralTimestamp` (P4).

5. **wallet F5 was under-scoped by the audit.** It named `location = /sharing` and `location = /install`
   and stopped there; the same `add_header` rule strips the same six headers in four more blocks of
   the same file, including the one serving the SPA's `index.html` (P1). The audit's own evidence
   sentence (*"nginx's rule is that `add_header` is inherited only if the current level declares
   none"*) is the general rule, and it did not apply it generally. `apps/business/nginx.conf` had
   already been fixed the right way and is one directory over.

6. **Register 9.14 "branch-only" — the audit was right and `d88272d` restates it correctly.**
   Confirmed by history: the SharingHost `pendingResult` code came from `a5b8e2ceb`
   ("feat(sdk/android): keep the sharing sheet alive across a rotation", 2026-08-05), which
   `git merge-base --is-ancestor a5b8e2ceb f1dc693` confirms is an ancestor of the base. Minor:
   `d88272d`'s message says 9.14 "is now closed by the fix in the first commit of this branch" — the
   fix is in `96024ee38`, the *second* commit (`052e44c0f` is the iOS test fix).

7. **A6 ("publishing is broken by Dokka") — the audit correctly flagged the compass files as stale.**
   `f5db3d231` ("fix(sdk/android): unblock publishing with a stub javadoc jar (A6)") is in history;
   `AGENTS.md:59` and `sdk/AGENTS.md:63` are now corrected. Land.

---

## Verified-OK

- **nginx `add_header` inheritance semantics** as stated in the commit message and the in-file
  comment: correct (inherited from the previous level iff the current level declares none).
- **All six headers, verbatim and `always`, in both re-declared blocks** — byte-compared against
  `apps/wallet/nginx.conf:48-59`. No partial re-declaration.
- **`bindI18nStore: "added"` is the right mechanism** and is on both bootstraps, matching the
  in-repo precedent and its comment (`apps/business/src/i18n/loadBundle.ts:10`).
- **`isDuplicate`'s new comment is not falsifiable by grep** — no native, web, or `sdk/core`
  consumer of any `track/*` response field exists.
- **ROLLOUT.md's three migration filenames** all begin with the `proof_seen_at` ALTER.
- **Android merchant README snippet type-checks by inspection** against `frak-sdk.api`.
- **iOS mirror README quickstart type-checks by inspection**; `frakwallet` is the production scheme;
  `handleReferral` is `@discardableResult` so the SceneDelegate snippet warns about nothing.
- **PRIVACY.md's caps and header casing** match `EventQueue.kt:376,379` and `FrakSdkVersion.kt:15`.
- **`x-frak-sdk-version` value change to `android/0.0.1`** (`FrakSdkVersion.kt:23`) breaks nothing
  server-side: the backend only logs it (`services/backend/src/index.ts:64-65`) and the schema is a
  free `t.String()` (`infrastructure/macro/session.ts:68`).
- **9.1 / 9.16 / 9.13 revert notes** — every identifier the notes call absent is absent; the
  replacement `Phase` enum is present; there is no atomic in `frak-sdk-ui`.
- **A7 17/17 and `@InternalFrakApi` 4/7** — both reproduced.
- **`scripts/check-comments.ts`** — ran it: clean across 276 files on the branch tree; the two
  `Package.swift` roots really were outside every prior root and now pass.
- **`Rejected → continue`** (`EventOutbox.kt:272-276`) means the new 422 on an out-of-range
  `sharingTimestamp` cannot stall the queue.

---

## Commands worth re-running before merge

```bash
# the two that would have caught P1 and P3
nginx -t -c apps/wallet/nginx.conf && curl -sI https://<host>/ | grep -i x-frame-options
bun run test --filter services/backend -- src/api/user/merchant/index.test.ts
```

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Read-only review of f6ff19afc (backend/wallet) and d88272d98 (docs/register/READMEs/tooling) plus a history re-check of every audit finding that rested on git log, written to /tmp/frak-fixes/platform-docs-and-audit-errors.md. No repo file was created, modified or staged; scratch under /tmp/fx only."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Every claim carries a path:line or a commit sha, and the disputable numbers are recomputed in-report: Android 392+144=536 exactly; iOS 502 @Test / 54 @Suite; §3.7 552 raw at tip vs 507 at f1dc693; 32ecd209f's diff contains 0 occurrences of checkDexSizeBudget; a5b8e2ceb is an ancestor of f1dc693."
    }
  ],
  "changedFiles": [
    "/tmp/frak-fixes/platform-docs-and-audit-errors.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git log -1 --format=%B f6ff19afc / d88272d98 / 32836c217 / fc069c9be / 0c978b12f / eccb8c23f",
      "result": "passed",
      "summary": "Read the four branch commit messages plus the three history commits the audit's disputed claims depend on."
    },
    {
      "command": "git diff f1dc693 review/alpha-fixes -- services/backend apps/wallet docs .github scripts sdk/*/README*",
      "result": "passed",
      "summary": "Full platform-side and docs-side delta reviewed line by line."
    },
    {
      "command": "git log --oneline -S 'checkDexSizeBudget' --all ; git show 32ecd209f | grep -c checkDexSizeBudget",
      "result": "passed",
      "summary": "14 commits touch the string (added cd50f13f8, removed 32836c217). The commit the audit cited as sole origin, 32ecd209f, contains 0 occurrences — a shallow-clone graft artefact."
    },
    {
      "command": "git merge-base --is-ancestor a5b8e2ceb f1dc693",
      "result": "passed",
      "summary": "Confirms register 9.14 was never 'branch-only' — the code shipped on dev."
    },
    {
      "command": "grep -rn '@Test' sdk/android/*/src/test | wc -l (branch and f1dc693); grep -rno '@Test' sdk/ios/Tests | wc -l",
      "result": "passed",
      "summary": "Android 536 (392+144) at tip, 515 at base; iOS 502 declarations / 54 suites at tip, 498/55 at base."
    },
    {
      "command": "bun run scripts/check-comments.ts (in /tmp/fx/branch)",
      "result": "passed",
      "summary": "comment budget clean across 276 files, 99 baselined findings left."
    },
    {
      "command": "wc -l on the six §3.7 files at review/alpha-fixes and at f1dc693",
      "result": "passed",
      "summary": "552 raw at tip vs 507 at base — the branch's '507 as of 2026-08-13' is the pre-fix number."
    },
    {
      "command": "bun run test (backend)",
      "result": "not-run",
      "summary": "No node_modules in the worktree and installing was out of scope for a read-only review; all backend claims are source-read."
    }
  ],
  "validationOutput": [
    "nginx: six headers verbatim in apps/wallet/nginx.conf:153-158 and :171-176 vs server block :48-59 — complete; four other blocks (:62-68, :71-77, :84-114, :186-192) still declare add_header and therefore still strip all six.",
    "IdentityProofService.ts:24 = 10*60 but :34 MAX_FUTURE_SKEW_SECONDS = 60 unchanged; AnonymousMergeService.ts:36 = 60-minute stateless JWT with no consumption record; MergeSender.kt:36-41 / MergeSender.swift:36-41 mint the proof per attempt.",
    "interactionSchemas.ts:19-22 bounds sharingTimestamp to int4; :13 referralTimestamp stays t.Number() and reaches the same ::int comparison via ArrivalHandler.ts:44 -> RewardHistoryOrchestrator.ts:241 -> InteractionLogRepository.ts:90-95, with the v2 codec legalising uint32.",
    "index.test.ts:337-369 builds a synthetic Elysia app with fakeLimiter and never invokes userMerchantApi, so it cannot fail if the production registration order changes.",
    "grep -rni 'lang|locale' over sdk/android/frak-sdk-ui/src/main and sdk/ios/Sources/FrakSDKUI: zero matches — audit §3.4 still open.",
    "03-sharing-and-install.md:250 'No simulator UI pass has run' vs 0c978b12f 'Verified on an iOS 26 simulator with a throwaway XCUITest driver'."
  ],
  "residualRisks": [
    "P1 nginx: the wallet SPA document still ships without X-Frame-Options/Referrer-Policy/Permissions-Policy/COOP/XSS-Protection. Before adding them, confirm no first-party surface frames the SPA (the listener is a separate app with its own conf using CSP frame-ancestors).",
    "iOS test count 495 and the KB figures (318/321) are not verifiable without the toolchain; I state which side of each I could reproduce and which I could not.",
    "The Postgres reasoning in audit-claim 4 (partial expression index evaluating ::int at INSERT) is read from schema.ts:53-55 and SharingHandler.ts:25-27, not executed against a database.",
    "Elysia's .as('scoped') propagation into userMerchantApi's post-exploreApi routes is read from rateLimiter.ts:213 and index.ts:205-206, not executed."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository changes. One new report at /tmp/frak-fixes/platform-docs-and-audit-errors.md.",
  "reviewFindings": [
    "high: apps/wallet/nginx.conf:186-192 - the F5 fix was applied to the two blocks the audit named; location ~ \\.html$ (which serves the SPA's index.html via the try_files fallback), plus :62-68, :71-77 and :84-114, still declare add_header and therefore still strip all six server-level security headers.",
    "medium: services/backend/src/domain/identity/services/IdentityProofService.ts:18-21,34 - the widening is past-side only (MAX_FUTURE_SKEW_SECONDS=60 untouched, no frak-merge-v1 future-skew test) and its stated justification is false: AnonymousMergeService.ts:36 mints a 60-minute stateless JWT with no replay cache, and MergeSender.kt:36-41 mints the proof per attempt so a queued retry never consumed the window. iOS still stamps device time (AnonymousIdStore.swift:71).",
    "medium: services/backend/src/api/user/merchant/index.test.ts:337-369 - the 'production registration order' test builds a synthetic app and never touches userMerchantApi, so it cannot fail if the bug returns.",
    "medium: services/backend/src/api/schemas/interactionSchemas.ts:13 - referralTimestamp is the other half of the same ::int join and is still unbounded, reachable from the frozen uint32 FrakContext v2 codec; the SDKs got a doc comment only, and there is no schema test.",
    "medium: docs/plans/native-sdk/03-sharing-and-install.md:250 - 'No simulator UI pass has run' contradicts 0c978b12f's own commit message and the same branch's AGENTS.md:59 / sdk/ios/README.md:95.",
    "medium: audit §3.4 (no locale forwarded by either sharing sheet) is untouched and still open; bindI18nStore closes a different bug.",
    "low: .github/workflows/apps.yaml - lint:comments runs only in the android-sdk job, which is gated on sdk/android/**, while three of the checker's eight roots live under example/** which cannot even trigger the workflow.",
    "low: docs/plans/native-sdk/06-open-findings.md:167 still lists the dex budget inside check and the 396/42 counts the same commit calls wrong; 09-android-api-surface.md:602 likewise.",
    "low: docs/plans/native-sdk/06-open-findings.md:119 - the corrected §3.7 count (507 raw) is the f1dc693 figure; the branch's own 96024ee grew those files to 552.",
    "nit: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/ServerClock.kt:7-10 still says the backend rejects a merge proof outside a 2-minute window, which f6ff19afc changed to 10 in the same branch.",
    "nit: docs/plans/native-sdk/12-alpha-audit-response.md:3 links 11-alpha-audit.md and audit-2026-08-13/, neither of which exists on this branch.",
    "audit error (proven): audit-2026-08-13/register-challenge.md:24 cites 32ecd20 as the only commit touching checkDexSizeBudget; that commit's diff contains zero occurrences of the string and is the shallow clone's graft boundary."
  ],
  "manualNotes": "Two things the parent may want to route elsewhere. (1) The Postgres mechanism in audit-claim 4 means the sharingTimestamp bound is a bigger win than either the audit or the commit message claims — an out-of-range value used to fail the INSERT (partial expression index) and, pre-96024ee, stall the whole outbox on Retryable/break. That strengthens the case for bounding referralTimestamp too. (2) The ServerClock parity gap (Android-only) is disclosed honestly in 12-alpha-audit-response.md:47 but NOT in the commit message that widened the window, which reads as if the platform fix were complete; whoever reviews the SDK-side commit should confirm the iOS port is tracked."
}
```
