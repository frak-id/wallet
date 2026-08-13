# Round 3 — the two docs commits: the §2.2 withdrawal and the three "decisions"

Scope: `388b8c5b3` and `5609ea270` (both touch only `docs/plans/native-sdk/12-alpha-audit-response.md`),
adjudicated against the code on `review/alpha-fixes` (tip `388b8c5b3`). All line numbers are the branch's,
read with `git show review/alpha-fixes:<path>`.

---

## Verdict (5–10 lines)

The §2.2 withdrawal is **PARTIALLY correct, and correct on the part that matters most**: the audit's headline fix
("bind the merge token to a verifiable origin") genuinely cannot be built for the flow that ships `?fmt=`, because the
redeeming id does not exist at mint time. The audit was wrong to grade this P0/"identity capture by link"; medium is
defensible. But the write-up then over-narrows the residual (past value migrates, not just future attribution; group
scope ≠ merchant scope; the victim is silently locked out of ever binding their own wallet), and — worse — the
withdrawal is used to authorise dropping the §3.3 proof gate. That gate was not only about `?fmt=`: `/merge/execute`
takes **no authentication at all** (`merge.ts:63-104`), the target is now get-or-created (`AnonymousMergeOrchestrator.ts:216-221`),
and the latch fails open for any unlatched id (`latchedProof.ts:60-73`). Two unauthenticated POSTs now fold any
unlatched `anonymousId` into an attacker group — no link, no victim device, no SDK. That is the audit's §3.3 warning,
executed, and §7's phishing-grade threat model does not cover it.
Of the three "decisions", one is sound-with-a-false-residual (§2.1), one is a real decision the team is entitled to take
but whose stated premise is now contradicted by its own code (`?fmt=` ships → "with the proof gate"), and one
(`SharingSheetStateTest` calling production) is an **unacknowledged deferral** dressed as a decision — it answers the load
objection and none of the others. Internal consistency got worse, not better: `§1` of the response now contradicts `§8`
on five blocker/high rows, every drift item from round 2 (`06:25`, `46%`, `isMinifyEnabled = false`, `sdk/AGENTS.md:62` vs `:67`)
is untouched, and the branch created fresh drift (reward constructors) that the docs commit existed to catch.

---

## Fixes that land

- **§2.2 methodology** — the "cannot be built" argument is correct and load-bearing: `AnonymousMergeService.generateToken`
  signs `sourceGroupId`/`sourceMerchantId` only and never a target (`AnonymousMergeService.ts:38-43`); the in-app-browser
  escape mints for A and is redeemed by a B that does not exist yet. `12-alpha-audit-response.md:308-324`.
- **§2.2 mitigation list is accurate** — the token really is a stateless 60-min JWT with no replay record
  (`AnonymousMergeService.ts:36,67-92`), so "make it single-use, cut the TTL" are the right two asks. `:341-348`.
- **`WALLET_CONFLICT` / anchor-direction bound is real** — `IdentityOrchestrator.associate` refuses two wallet-bearing
  groups (`IdentityOrchestrator.ts:84-94`) and `checkWalletPriority` anchors on the wallet-bearing side
  (`IdentityWeightService.ts:191-203`), so an attacker with no wallet donates rather than gains. The audit never mentioned
  either. `:326-334`.
- **§2.4 diagnosis is precise and honest** — `onPageReady()` (document-finished) calls `settleContent()`
  (`SharingSheetState.kt:247-249,257-259`) and `onLoadDeadline()` returns early on `pageLoaded` (`:270-271`); `pageVisible`
  is the `postVisualStateCallback` paint signal (`:223-231,262-263`). The revert reason (the `activated page is not
  abandoned to tier 3` test at `navigateNow`, `SharingSheetState.kt:206-220`) is real. Deliberate non-fix, correctly filed.
- **F15 reclassification is factually correct** — `rg prefers-color-scheme apps/wallet` returns nothing; the only hit in the
  repo is `packages/design-system/src/hooks/useMediaQuery.test.ts`. One product decision across three surfaces, as claimed. `:370`.
- **§2.1 downgrade's core claim is right** — the install proof is a P-256 signature over `(op, merchantId, anonymousId, ts)`
  verified statelessly (`IdentityProofService.ts:78-86`); interception cannot forge one for another id. Blocker was too high.
- **The §2.1 fix shipped anyway** — `AppLauncher.open(url, packageId)` with `setPackage` on the wallet arm
  (`DefaultFrakClient.kt:337-340`, `AppLauncher.kt`), so the decision was taken *and* the one-liner landed. `:367`.
- **§3.8a genuinely closed** — `ktlint_standard_no-unused-imports = enabled` in both `.editorconfig`s (`1cdf7aa99`), with the
  iOS "no equivalent exists" explanation written into `sdk/AGENTS.md:65`. This is the model the rest of the doc should follow.

---

## Fixes that DO NOT fully land

### P1. §2.2 withdrawal → used to drop §3.3's proof gate, and the resulting hole needs no SDK, no link and no victim

- **Claimed in:** `12-alpha-audit-response.md:39-41` ("the get-or-create has to land, **with the proof gate**, in the order
  the audit gives"), `:80` ("The audit's sequencing warning was predicated on §2.2 being a live escalation; §7 shows it is
  not, so the get-or-create lands on its own"), `:362` ("`TARGET_NOT_FOUND` is gone").
- **Reality:** `services/backend/src/api/user/identity/merge.ts:63-104` — `/merge/execute` declares **no**
  `withWalletOrSdkAuthent`; the only gate is an IP-keyed 20/min limiter (`:8`). `AnonymousMergeOrchestrator.ts:198-221` runs
  `enforceProof` then `IdentityOrchestrator.resolve` (get-or-create) with no proof branch;
  `latchedProof.ts:60-73` returns `false` (allow) whenever the target node is absent or unlatched. `/merge/initiate`
  (`merge.ts:9-61`) is equally unauthenticated for an anonymous source, and an attacker's fresh id has never latched, so it
  needs no proof either. Net: **two unauthenticated POSTs fold any unlatched `anonymousId` into the attacker's group.**
  The audit predicted this verbatim (`11-alpha-audit.md` §3.3, "anyone can name any `anonymousId` as a merge target, have it
  conjured, and fold it into their own group with no proof").
- **Residual severity:** **high** (was: partly blocked by the 404 for never-seen ids; already open for any id that had a node
  but no latch, which is most of the web population). Bounded by `WALLET_CONFLICT` and the wallet-anchor rule, so the prize is
  still a wallet-less user's attribution at one merchant — but it is now harvestable in bulk from any IP, with no phishing
  step, which is precisely the delivery cost §7 leans on to justify "not urgent".
- **What to do:** implement the audit's sketch as written — auto-create the target **only** inside the proof-verified branch
  (`proofPresented === true`), keep `TARGET_NOT_FOUND` otherwise; native signs from day one so it costs native nothing. And
  put `withWalletOrSdkAuthent` on `/merge/execute`. Then correct `:39-41` and `:80`, which currently claim the gate landed.

### P2. Decision 1 ("`?fmt=` ships") — the decision is theirs to take; the code does not match what the decision says

- **Claimed in:** `:39-41` (still, at tip) — "`merge/execute` **404s on a fresh install today**, and the flow shipping means
  the get-or-create has to land, **with the proof gate**".
- **Reality:** `7a673da17` removed the 404 two commits later (`AnonymousMergeOrchestrator.ts:211-221`) and shipped **no** proof
  gate; `388b8c5b3` rewrote the neighbouring sentence in the same paragraph (`:41`, "§2.2 … **dropped** — see §7") and left both
  false clauses standing. The document therefore states a precondition, records the work as done in `§8`, and never notices the
  precondition was dropped.
- **Residual severity:** medium (documentation), high in effect because it is the sentence a future reader will use to conclude
  the gate exists.
- **What to do:** rewrite `:39-41` to say plainly "get-or-create landed **without** the proof gate; here is why we think that is
  acceptable", or land the gate.

### P3. Decision 3 (`SharingSheetStateTest` hitting production is "accepted") — an unacknowledged deferral

- **Claimed in:** `:54-55` ("The backend absorbs the load … closed here by decision").
- **Reality:** `SharingSheetStateTest.kt:45-49` still calls `Frak.initialize(context, frakConfig(...))`;
  `SharingInputFixtures.kt:58` builds `FrakConfig.Builder(merchantId).build()` and `FrakConfig.kt:133` defaults
  `env = FrakEnvironment.Production`. The finding (`11-alpha-audit.md` §3.8b) had four parts: live egress from CI, **CI/offline
  non-determinism**, **a leaked `SupervisorJob` + lifecycle callbacks + queue file into four other Robolectric classes**, and
  **no reset seam (`T2`)**. The decision answers only the first. The response's own `§1` row (`:68`) still prints the two-line
  fix and the `Frak.resetForTesting()` ask, i.e. the document simultaneously accepts and recommends.
- **Residual severity:** low-medium; cost of the real fix is two lines plus a seam, which is the tell.
- **What to do:** either state the three unanswered parts explicitly and defer them by name, or spend the two lines
  (`FrakEnvironment.Custom` on loopback is already allowlisted).

### P4. Decision 2 (§2.1 downgrade) — right conclusion, wrong residual, and it omits the credential that actually matters

- **Claimed in:** `:48-52` — "the proof is **single-use server-side**, so a hostile app that claims `frakwallet://` first can
  *consume* it … attribution-integrity bug, not a confidentiality one".
- **Reality:** there is no consumption anywhere. `IdentityProofService` is documented as "Stateless and pure … the `proofSeen`
  latch is a separate concern" (`IdentityProofService.ts:69-77`); `frak-install-v1` has a **30-day** window (`:26`) and nothing
  records redemption. The named residual does not exist. The residual that *does* exist is the other half of the same intent:
  the leaked **`anonymousId`** is by itself a sufficient credential on `/identity/ensure`'s wallet arm, which accepts a bare
  `bodyAnonymousId` with any wallet session and never requires a proof (`ensure.ts:78-89,105-122`, comment: "a raw id with
  nothing proving it belongs to the caller"). So the audit's stated impact ("bind the victim's identity to a wallet the
  attacker controls") survives the downgrade — it just does not depend on the proof.
- **Residual severity:** medium (Android is fixed by `setPackage`; iOS falls back to the custom scheme when universal links are
  disabled, `DefaultFrakClient.swift:420-432`).
- **What to do:** replace the "single-use" sentence with the `ensure.ts` wallet-arm fact, and file the wallet arm (ROLLOUT-STEP-3)
  as its own row rather than leaving it implicit in two withdrawn findings.

### P5. §2.2's residual is understated in three specific ways

- **Claimed in:** `:336-339` — "the prize is their **future** attribution at a single merchant — the users with the least
  accrued value".
- **Reality:** (a) `IdentityMergeService.mergeGroups` migrates `purchases`, `purchase_claims`, `interaction_logs`,
  `asset_logs`, `referral_links` and `referral_codes` to the anchor (`IdentityMergeService.ts:30-71`), so accrued, unclaimed
  value moves with the group — not only future events. (b) After capture the victim can never bind their own wallet: the
  ensure path converts `WALLET_CONFLICT` into a terminal `WALLET_ALREADY_LINKED` 409 (`ensure.ts:302-318`) and the
  login/register anchor path swallows the failure (`IdentityOrchestrator.ts:192-200`), so the lockout is silent and permanent.
  (c) "Merchant scope" bounds the *token* and the *target node*, not the merge: `associate()` operates on groups, and a group
  spans merchants once anything has joined them. For the wallet-less target population it is usually true, but it is stated as
  a hard bound.
- **Residual severity:** medium — the grade (blocker → medium/attribution theft) still holds; the *description* under-sells it.
- **What to do:** three sentences in `§7`. Also state that `74e43c4c3` **widened** the intake: `DeepLinkObserver` now consumes
  `onNewIntent` as well as create/resume (`DeepLinkObserver.kt:24-50`) and gates only on "carries `fCtx` or `fmt`"
  (`:82-85`) — no host check — so any locally installed app that can start an exported merchant activity triggers the merge on a
  warm start too. The withdrawal was written in the same batch that increased the finding's reachability and does not say so.

### P6. §7 forecloses the cheap mitigation it never quotes

- **Claimed in:** `:350-351` — "**Do not re-file 'bind the token to an origin'.**"
- **Reality:** the audit's short-term ask was narrower and *is* buildable: "only accept `fmt` from a URL that also carries a
  valid `fCtx` for this merchant" (`audit-2026-08-13/security-privacy.md` F2, Fix sketch). Today `parseToken` accepts `fmt`
  from any URL and any host (`IdentityMerge.kt:37`) and `handleReferralLink` merges **before** the arrival guard
  (`DefaultFrakClient.kt:271-272`), so the merge runs even when `fCtx` is absent or foreign — the SDK deliberately ignores the
  one signal it already parses. Whether to require it is a judgement call; refusing the whole family without quoting the cheap
  member is not.
- **Residual severity:** low-medium.
- **What to do:** name the `fCtx`-correlation variant in `§7` and reject it on its merits (it would break the pure-`?fmt=` link
  the in-app-browser escape emits, which is the honest reason), rather than by generalisation.

---

## NEW defects introduced

### N1. The response's `§1` table now contradicts its own `§8` on five blocker/high rows

- **Severity:** medium · **Axis:** docs-accuracy · **Complexity:** trivial · **Introduced by:** `388b8c5b3`
- **Evidence:** `12-alpha-audit-response.md:7-8` "Everything **blocker / high** was verified against the tree and is reported
  below **rather than changed**"; then `§8` records five blocker/high rows as changed: §2.1 (`:367`), §2.3 (`:363`),
  §3.5 (`:366`), §4.3 (`:365`), §4 row 1 (`:368`). The `§1` rows were not updated: `:65` still prints the §2.1 fix sketch,
  `:76` still says "I did not fix it … left the SDK-side listener to you" for §2.3, `:66` still says §3.5 needs `guard !lent`,
  `:69` still says §4.3 is "free to fix", and `:85` still says row 1 is "**deliberate and documented** … a decision for you,
  not a defect" — the exact opposite of what `74e43c4c3` shipped as a `BREAKING CHANGE`.
- **What actually happens:** a reader who trusts the summary tables (their stated purpose) gets five wrong answers, in the
  document written to stop exactly that.
- **Fix sketch:** strike or restate the five `§1` rows; `§8` is the newer truth.

### N2. `§3.1` still carries both numbers the branch itself disproved

- **Severity:** medium · **Axis:** docs-accuracy · **Complexity:** trivial · **Introduced by:** carried from round 2, untouched by all six commits
- **Evidence:** `:78` — "R8 shaking out **46%** of its classes" and "the harness's *committed* config is
  `isMinifyEnabled = false` (`app/build.gradle.kts:29`)". `§4` of the same file (`:158,174`) says the committed config is
  `isMinifyEnabled = true` and that the measurement is **23 of 254 = 9%**; `example/native-android/app/build.gradle.kts:29`
  reads `isMinifyEnabled = true`. Round 2 flagged both (`review-fix-branch/device-runs-and-response-doc.md` §2.2, §5.2.1).
- **What actually happens:** the row that exists to correct the audit's R8 claim is the row still repeating the disowned figure,
  80 lines above its own correction. The 46%↔9% reconciliation ("a different app") is still unexplained — both runs were
  `example/native-android`.
- **Fix sketch:** one sentence: which denominator each number counted, and which is authoritative.

### N3. The reward-constructor reversal left three documents describing the old surface

- **Severity:** medium · **Axis:** docs-accuracy · **Complexity:** trivial · **Introduced by:** `74e43c4c3` (code), not caught by `388b8c5b3` (the commit whose job was to record that batch)
- **Evidence:** `sdk/android/README.md:154` — "The reward models … keep **public** constructors, because a merchant does build
  one … which `PublicSurfaceTest` pins"; `docs/plans/native-sdk/09-android-api-surface.md:733-738` — "**Deliberately out of
  scope** … Open."; `06-open-findings.md:15` (A3/D7) still describes the policy as having stopped at the config tree. All three
  were made false by `74e43c4c3` (`frak-sdk.api` −9 lines, `@InternalFrakApi public constructor`, iOS `@_spi(FrakInternal)`).
- **What actually happens:** the README a merchant reads tells them to construct a type they can no longer construct.
- **Fix sketch:** three edits, in the docs commit that already exists for the batch.

### N4. `§8`'s §3.5 row is iOS-only and does not say so — the exact failure `§6` apologises for

- **Severity:** medium · **Axis:** docs-accuracy + parity · **Complexity:** small · **Introduced by:** `74e43c4c3` + `388b8c5b3:366`
- **Evidence:** `:366` — "`SharingWebViewPool.warm` guards `!lent`", no platform named. `74e43c4c3` touched
  `sdk/ios/.../SharingWebViewPool.swift` only. Android's twin still has no guard:
  `sdk/android/frak-sdk-ui/.../SharingWebViewPool.kt:32-37` (`warm()` checks `destroyed`, then rebinds and reloads `pooled`
  regardless of `lent`), and the trigger is present — `SharingHost.present()` calls `warm()` late (`SharingHost.kt:301`), whose
  async resolve lands in `applyWarmUrl() → pool.warm(url)` (`:214-236`) after the sheet has already `acquire()`d and set
  `lent = true` (`SharingWebViewPool.kt:60-74`); on the first share of a session `warmUrl` is null so the short-circuit at
  `:37` does not save it.
- **What actually happens:** first share of an app session can have the live sheet's web view re-navigated to the warm merchant
  page under the user — the identical §3.5 symptom, on the platform with the device pass. Round 2 already told them Android has
  this hole (`review-fix-branch/urls-sheet-and-parity.md`), and `§6:272-275` promises this class of overclaim is fixed.
- **Fix sketch:** `if (lent) return` in `SharingWebViewPool.warm`, and mark the `§8` row "iOS; Android open".

### N5. `§2.1`'s "honest list" still is not complete, while claiming to be

- **Severity:** low-medium · **Axis:** docs-accuracy · **Complexity:** small · **Introduced by:** `94744d8b4`, restated at tip
- **Evidence:** `:5-6` — "§2.1 lists **every** row in that band that was not [fixed]". Missing at minimum:
  public-api-ergonomics F6 / ABI row 8 — `heightFraction` still throws on Android (`FrakSharing.kt:50-59`) and clamps on iOS
  (`FrakSharingSheet.swift:143`); android-sharing-sheet F17 — still no test constructing the host layer while `SharingHost.kt`
  keeps growing. Both are medium, both in the declared band, both absent from `:112-122` and from `:126-138`.
- **Fix sketch:** add the two rows, or downgrade "every" to "the ones found so far", with a date.

### N6. Round-2 doc drift: every item is still there

- **Severity:** low-medium · **Axis:** docs-accuracy · **Complexity:** trivial · **Introduced by:** none of the six commits touched these files
- **Evidence:**
  - `06-open-findings.md:25` still says "anything only a minified release build does (**R8 has never run anywhere**)" — the
    team's own register repeating a claim the team refuted twice (`32836c217`, and `§4`'s 2026-08-13 device run).
  - `06-open-findings.md:167` still lists "dex budget" inside `check` and "iOS 396 tests in 42 suites" — both retired/false per
    `:26` of the same file.
  - `sdk/AGENTS.md:62` "**Nothing has run as a minified release build**" vs `sdk/AGENTS.md:67` "Measured 2026-08-13 driving the
    full harness on a device: 254 SDK classes reach R8, 23 are shaken out". Five lines apart.
  - `AGENTS.md:59` still frames device coverage as "in a debug build … cannot catch … what only R8 does"; it carries **no**
    number, **no** date and **no** app (round 2's premise that it once carried 46% was wrong — it never did).
  - `example/native-android/app/proguard-rules.pro:3` "even though `isMinifyEnabled = false`" vs `build.gradle.kts:29`.
  - "iOS device-tested since **2026-08-12**" survives in `AGENTS.md:59`, `sdk/AGENTS.md:62`, `06-open-findings.md:25`,
    `sdk/ios/README.md:97`, `03-sharing-and-install.md:252`, while `§5:201-203` calls 2026-08-13 the "**First time any of this
    has run on iOS hardware**". One of the two is wrong and nothing says which.
- **Fix sketch:** six one-line edits. The register is the file the audit's §6 is about; leaving it stale is the finding.

### N7. The document still cannot be read on its own branch

- **Severity:** low · **Axis:** docs-accuracy · **Complexity:** trivial · **Introduced by:** carried; both docs commits edited `:3` region without fixing it
- **Evidence:** `12-alpha-audit-response.md:3` links `./11-alpha-audit.md` and `./audit-2026-08-13/`; neither exists in
  `git ls-tree -r review/alpha-fixes -- docs/plans/native-sdk` (only `01`–`09`, `12`, `README.md`).
  `docs/plans/native-sdk/README.md:6-16` indexes `01`–`09` and neither `11` nor `12`. Every "§2.1 / §3.5 / §4 row 1" reference
  in the response has no referent on this branch.
- **Fix sketch:** commit the audit alongside, or make the links absolute to the audit branch, and add `11`/`12` to the index.

### N8. The merge-window widening is still justified by a claim `§7` now refutes

- **Severity:** low · **Axis:** docs/code consistency · **Complexity:** trivial · **Introduced by:** carried; `§7` newly contradicts it
- **Evidence:** `services/backend/.../IdentityProofService.ts:19-21` — "`frak-merge-v1`: 10 minutes — **the token it is bound to
  is single-use and short-lived**, so replay is bounded by the token". `§7:345-346` states the opposite: "It is a stateless JWT,
  so today it is **replayable without limit** for its whole life." The SDKs repeat the false claim in comments:
  `DefaultFrakClient.kt:297` and `DefaultFrakClient.swift:351` ("a merge token is single-use and short-lived").
- **What actually happens:** the 2→10 minute widening now rests on a premise the same branch documents as untrue, and three
  source files teach the next reader the wrong invariant.
- **Fix sketch:** either make the token single-use (`§7` mitigation 1) or correct the three comments and re-justify the window.

### N9. Commit-message overstatement: `pageVisible` is not "sitting there unused"

- **Severity:** nit · **Axis:** docs-accuracy · **Introduced by:** `388b8c5b3` commit message
- **Evidence:** `pageVisible` drives the skeleton crossfade and semantics today (`FrakSharingSheet.kt:166,184`). The document's
  own wording is precise ("unused **for this**", `:389-390`); the commit message drops the qualifier. Adjacent, unfixed:
  `SharingSheetState.kt:85` says `contentSettled` "Completes on **first paint** ([onPageReady])" while `:261` says
  `onPageReady` is document-finished and `onPageVisible` is paint — the KDoc encodes the very confusion `§8` diagnoses.

### N10. `§2` still describes a three-commit branch

- **Severity:** nit · **Axis:** docs-accuracy · **Introduced by:** `388b8c5b3` (added `§8` without touching `§2`)
- **Evidence:** `:98-105` — "**Three commits**, grouped by surface. Every one of them is green under the repo's own gates …
  (5587 tests), … (536 tests), … (495 tests)". The branch is now six commits past that; no gate figures are given for the second
  batch, which includes a `BREAKING CHANGE` ABI edit and a new Robolectric test dependency (`74e43c4c3`).

---

## Audit claims this branch proves wrong

1. **§2.2's recommended fix is not buildable, and the audit did not notice.** "Bind the merge token to an origin the SDK can
   verify" (`11-alpha-audit.md` §2.2) presumes a target that exists at mint time; the in-app-browser escape has none
   (`AnonymousMergeService.ts:22-51` signs source-only). The audit's own fallback ("mint against a nonce the target device
   supplies") describes a *different protocol*, not a fix to this one. **The team is right and the audit was wrong here.**
2. **§2.2's grade and framing ("identity capture by link", high/P0) are too high.** The audit never mentions `WALLET_CONFLICT`
   (`IdentityOrchestrator.ts:84-94`) or the wallet-anchor rule (`IdentityWeightService.ts:191-203,257+`), both of which bound
   the attack to wallet-less targets and make the attacker the loser in the mirror case. Medium/attribution-theft is the correct
   grade. The audit's F2 line "The wallet-conflict guard only saves a victim who has already linked a wallet" is true but was
   never carried up into the P0 write-up.
3. **§2.1's grade rested on the wrong noun.** The proof is not a secret (`IdentityProofService.ts:69-86`); the audit graded a
   public attestation as a bearer secret. (Its *impact* claim survives anyway, via `ensure.ts:78-89` — see P4 — but for a reason
   the audit did not give.)
4. **§3.8a's inference was wrong in the interesting direction.** "Either CI is red on `dev`, or the lint step is not doing what
   everyone believes" — it was the second: ktlint 1.7+ ships `no-unused-imports` **off**. The branch proved it and then fixed it
   (`1cdf7aa99`). Four documents had been citing a gate that did not exist.
5. **F15 is not a sheet defect.** No `prefers-color-scheme` anywhere in `apps/wallet`; the audit filed a three-surface product
   gap as an Android sheet bug.
6. (Already conceded, restated for the record) **`checkDexSizeBudget` existed**; the audit's shallow clone made every
   "this never happened" claim unfalsifiable. The team's correction stands; only the 46%↔9% reconciliation is still open (N2).

---

## Silent omissions — audit findings these six commits should have addressed and never mention

Grepped against the whole response doc on the branch. Absent means *zero occurrences*, not "deferred with a reason".

- **§2.5 and §2.6 — the merchant-DX P0** (no artifact/dependency snippet, `logLevel` silent by default, the mandatory
  allow-listing step documented only in the harness READMEs, the non-compiling iOS quickstart, `LSApplicationQueriesSchemes` +
  Associated Domains). The audit called §2.5 "the single highest-leverage day available". **Not one mention in the response, in
  either docs commit, or in the `deliberately not fixed` table.** This is the largest omission on the list.
- **§3.4 — locale.** Every non-`en`/`fr` device gets a French sheet. Zero mentions; `rg -i locale sdk/android/frak-sdk*/src/main`
  still returns nothing, so the finding is untouched *and* unrecorded. The round-1 review explicitly warned it was still open.
- **§9.3 delta findings, all of them:** `InstallProbe` N1 (`generation` not invalidated in `stop()`), N2 (extra uncancellable
  poll chain per foreground), N5 (no ceiling), the `/install` "Open the wallet" CTA whose `href` points at the App Store for a
  user who already has the app, `walletOpened` outranking `shared` in `significance` (a real share never reaches `onResult`),
  N3 (`dismiss()` during in-flight `present()`), N4 (previous deadline settles the next continuation), N9 (`/install` grew to
  10 iOS-only keys with no version signal), N8 (the scheme diagnostic routed into `FrakLogLevel.none`).
- **§4 rows 2, 5, 6, 7, 8, 9, 10** — dismissed in one clause (`:85` "Same for rows 2, 5, 6, 7, 8, 9 and 10") while row 1 was
  decided unilaterally in the *opposite* direction to what that same row says. Row 6 (`SharingResult` exhaustive-`when`
  runtime break) is the one this branch made more expensive by shipping another `BREAKING CHANGE`.
- **§5 long tail:** the sybil/abuse boundary (security F3 — "`/track/*` authenticates nothing", no register row exists),
  ATT (F4, App Store rejection risk, "needs a legal decision before iOS ships"), the anonymous id in the `/sharing` query string
  forwarded to OpenPanel against `PRIVACY.md` (F5), consent withdrawal not clearing WebView storage (F6), accessibility on both
  sheets, merchant observability (correlation id, delivery signal, queue depth), the merchant test seam, Android's chooser-open
  `Shared` inflation, purchase-vs-analytics reliability tiering and the on-disk row format (§4 row 10).
- **Round-2 review items not addressed and not named:** `ServerClock` not persisted across cold start (the 30-day install proof
  can still be minted on the device clock); `SharingLinkBuilder.build` returning bare `null` for a non-http(s) base against the
  published contract; the rate-limit test that does not import the production module; `referralTimestamp` unbounded while
  `sharingTimestamp` is; the 20-row checkpoint's read+rewrite cost; the six "no artifact" gaps from the device runs (no
  logcat, no `mapping.txt`, no class list, no `xcresult`, and still no gate keeping `isMinifyEnabled = true`).
- **`§6` undercounts its own commit:** it says "Three findings landed", while `94744d8b4` also closed the `ServerClock` upper
  bound + KDoc, the `getExact` key-match on both platforms, and iOS `resetAnonymousId`. The commit message lists them; the
  status doc does not. Harmless here, but it is the same "the doc is not the diff" gap in miniature.

---

## Verified-OK

- `AnonymousMergeService.generateToken/validateToken` behave exactly as `§7` describes: source-only claims, merchant match,
  60-min TTL, no replay record (`AnonymousMergeService.ts:22-100`).
- `IdentityOrchestrator.resolve` really is race-safe as `§8` claims — unique-constraint contention with the loser rolling back
  its empty group (`IdentityOrchestrator.ts:31-57`); `markProofSeen` really did move after the resolve
  (`AnonymousMergeOrchestrator.ts:223-231`), which is a genuine correctness fix (`markProofSeen` is a no-op on a missing node).
- `§8`'s §2.3 row checks out: `DeepLinkObserver` subscribes to `OnNewIntentProvider`, `compileOnly`, with a
  `NoClassDefFoundError` fallback and listener removal on destroy (`DeepLinkObserver.kt:24-50,77-80`).
- `§8`'s §2.1 row checks out: the wallet arm is package-pinned, the store arm deliberately is not
  (`DefaultFrakClient.kt:337-346`).
- `§8`'s §4-row-1 row checks out: `frak-sdk.api` loses exactly nine constructor lines; iOS took `@_spi(FrakInternal)`.
- `§7`'s two proposed mitigations are the right two, and both are correctly described as backend-only.
- `ServerClock` gained the upper plausibility bound and the KDoc now cites the 10-minute window (`ServerClock.kt:30-31,49-50`) —
  round 2's complaint is closed (though 2100-01-01 is a very loose ceiling and it is still not persisted).
- `§2.1`'s parity table rows F12 (`getExact` on both platforms) and `resetAnonymousId` ("fixed on both") match the tree.
- The `§8` F15 and iOS-15-layout entries are accurate and appropriately scoped.
